<script lang="ts">
  import { onMount } from 'svelte';
  import { getVideo, updateMetadata, type Video } from '../api';
  import { push } from 'svelte-spa-router';
  import AutocompleteInput from './AutocompleteInput.svelte';

  export let params: { id: string } = {} as any;

  let video: Video | null = null;
  let loading: boolean = true;
  let error: string | null = null;

  // Edit mode state
  let isEditing: boolean = false;
  let editForm: {
    perf_date: string;
    group_name: string;
    artist_name: string;
    song_title: string;
    event: string;
    camera_type: string;
  } = {
    perf_date: '',
    group_name: '',
    artist_name: '',
    song_title: '',
    event: '',
    camera_type: '',
  };
  let saving: boolean = false;
  let saveError: string | null = null;

  async function fetchVideo() {
    loading = true;
    error = null;
    try {
      video = await getVideo(params.id);

      // Initialize edit form with current values
      editForm = {
        perf_date: formatDateForEdit(video.perf_date),
        group_name: video.group_name || '',
        artist_name: video.artist_name || '',
        song_title: video.song_title || '',
        event: video.event ? video.event.replace('@', '') : '',
        camera_type: video.camera_type || '',
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to fetch video';
    } finally {
      loading = false;
    }
  }

  function formatDateForEdit(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function toggleEditMode() {
    isEditing = !isEditing;
    saveError = null;
  }

  async function handleSave() {
    saving = true;
    saveError = null;
    try {
      if (!video) {
        throw new Error('Cannot save changes: video data is not loaded.');
      }

      const updateData = {
        perf_date: editForm.perf_date || null,
        group_name: editForm.group_name || null,
        artist_name: editForm.artist_name || null,
        song_title: editForm.song_title || null,
        event: editForm.event ? '@' + editForm.event.toUpperCase() : null,
        camera_type: editForm.camera_type || null,
      };

      video = await updateMetadata(video.id, updateData);
      isEditing = false;

      // Refresh the video data
      await fetchVideo();
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    if (video) {
      editForm = {
        perf_date: formatDateForEdit(video.perf_date),
        group_name: video.group_name || '',
        artist_name: video.artist_name || '',
        song_title: video.song_title || '',
        event: video.event ? video.event.replace('@', '') : '',
        camera_type: video.camera_type || '',
      };
    }
    isEditing = false;
    saveError = null;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'new':
        return 'bg-green-100 text-green-800';
      case 'needs_review':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDateDisplay(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function goBack() {
    push('/videos');
  }

  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = `https://i.ytimg.com/vi/${video?.youtube_id}/hqdefault.jpg`;
  }

  onMount(() => {
    fetchVideo();
  });
</script>

<div class="p-6 max-w-5xl mx-auto">
  <button on:click={goBack} class="mb-4 text-pink-600 hover:text-pink-800 font-medium">
    ← Back to Videos
  </button>

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      {error}
    </div>
  {:else if video}
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-white truncate">{video.original_title}</h1>
          <span
            class="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-white/20 text-white"
          >
            {video.status}
          </span>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Thumbnail -->
          <div class="md:col-span-1">
            <img
              src="https://img.youtube.com/vi/{video.youtube_id}/maxresdefault.jpg"
              alt="Thumbnail"
              class="w-full rounded-lg shadow-md"
              on:error={handleImageError}
            />
            <a
              href="https://www.youtube.com/watch?v={video.youtube_id}"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 block text-center text-sm text-pink-600 hover:text-pink-800"
            >
              Watch on YouTube
            </a>
          </div>

          <!-- Details -->
          <div class="md:col-span-2 space-y-4">
            <div>
              <h3 class="text-sm font-medium text-gray-500">Published Date</h3>
              <p class="text-gray-900">
                {video.published_at && formatDateDisplay(video.published_at)}
              </p>
            </div>

            {#if video.channel_title}
              <div>
                <h3 class="text-sm font-medium text-gray-500">Channel</h3>
                <p class="text-gray-900">{video.channel_title}</p>
              </div>
            {/if}

            {#if video.playlist_title}
              <div>
                <h3 class="text-sm font-medium text-gray-500">Playlist</h3>
                <p class="text-gray-900">{video.playlist_title}</p>
              </div>
            {/if}

            <!-- Metadata Section -->
            <div class="border-t pt-4 mt-4">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900">Metadata</h2>
                {#if !isEditing}
                  <button
                    on:click={toggleEditMode}
                    class="px-4 py-2 text-sm font-medium text-pink-600 border border-pink-600 rounded-md hover:bg-pink-50"
                  >
                    Edit
                  </button>
                {/if}
              </div>

              {#if isEditing}
                <div class="space-y-4">
                  <AutocompleteInput
                    label="Performance Date (YYMMDD)"
                    type="groups"
                    placeholder="e.g., 240315"
                    bind:value={editForm.perf_date}
                  />
                  <AutocompleteInput
                    label="Group Name"
                    type="groups"
                    placeholder="Enter group name"
                    bind:value={editForm.group_name}
                  />
                  <AutocompleteInput
                    label="Artist Name"
                    type="artists"
                    placeholder="Enter artist name"
                    bind:value={editForm.artist_name}
                  />
                  <AutocompleteInput
                    label="Song Title"
                    type="songs"
                    placeholder="Enter song title"
                    bind:value={editForm.song_title}
                  />
                  <AutocompleteInput
                    label="Event"
                    type="events"
                    placeholder="Enter event name"
                    bind:value={editForm.event}
                  />
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Camera Type</label>
                    <input
                      type="text"
                      bind:value={editForm.camera_type}
                      placeholder="e.g., FANCAM, VERTICAL FANCAM"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>

                  {#if saveError}
                    <div
                      class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm"
                    >
                      {saveError}
                    </div>
                  {/if}

                  <div class="flex gap-2 pt-2">
                    <button
                      on:click={handleSave}
                      disabled={saving}
                      class="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      on:click={handleCancel}
                      disabled={saving}
                      class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              {:else}
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Performance Date</dt>
                    <dd class="text-gray-900">
                      {video.perf_date ? formatDateDisplay(video.perf_date) : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Group</dt>
                    <dd class="text-gray-900">{video.group_name || '-'}</dd>
                  </div>
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Artist</dt>
                    <dd class="text-gray-900">{video.artist_name || '-'}</dd>
                  </div>
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Song</dt>
                    <dd class="text-gray-900">{video.song_title || '-'}</dd>
                  </div>
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Event</dt>
                    <dd class="text-gray-900">{video.event || '-'}</dd>
                  </div>
                  <div>
                    <dt class="text-sm font-medium text-gray-500">Camera Type</dt>
                    <dd class="text-gray-900">{video.camera_type || '-'}</dd>
                  </div>
                </dl>
              {/if}
            </div>

            <!-- Action Buttons (placeholders) -->
            <div class="border-t pt-4 mt-4">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Actions</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  disabled
                  class="px-4 py-2 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed text-sm"
                  title="Coming soon"
                >
                  Confirm Download
                </button>
                <button
                  disabled
                  class="px-4 py-2 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed text-sm"
                  title="Coming soon"
                >
                  Rename File
                </button>
                <button
                  disabled
                  class="px-4 py-2 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed text-sm"
                  title="Coming soon"
                >
                  Mark Complete
                </button>
              </div>
            </div>

            <!-- Preview Images Section (placeholder) -->
            <div class="border-t pt-4 mt-4">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Preview Images</h3>
              <div class="text-gray-400 text-sm italic">No preview images available yet.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
