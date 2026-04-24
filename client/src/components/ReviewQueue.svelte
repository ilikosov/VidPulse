<script lang="ts">
  import { onMount } from 'svelte';
  import { getVideos, updateMetadata, type Video } from '../api';
  import AutocompleteInput from './AutocompleteInput.svelte';

  interface ReviewVideo extends Video {
    editForm: {
      perf_date: string;
      group_name: string;
      artist_name: string;
      song_title: string;
      event: string;
      camera_type: string;
    };
    saving: boolean;
    saveError: string | null;
    saved: boolean;
  }

  let videos: ReviewVideo[] = [];
  let loading: boolean = true;
  let error: string | null = null;

  async function fetchVideos() {
    loading = true;
    error = null;
    try {
      const response = await getVideos({ status: 'needs_review', limit: 50 });
      videos = response.videos.map(video => ({
        ...video,
        editForm: {
          perf_date: formatDateForEdit(video.perf_date),
          group_name: video.group_name || '',
          artist_name: video.artist_name || '',
          song_title: video.song_title || '',
          event: video.event ? video.event.replace('@', '') : '',
          camera_type: video.camera_type || '',
        },
        saving: false,
        saveError: null,
        saved: false,
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to fetch videos';
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

  async function handleSave(video: ReviewVideo) {
    video.saving = true;
    video.saveError = null;
    try {
      const updateData = {
        perf_date: video.editForm.perf_date || null,
        group_name: video.editForm.group_name || null,
        artist_name: video.editForm.artist_name || null,
        song_title: video.editForm.song_title || null,
        event: video.editForm.event ? '@' + video.editForm.event.toUpperCase() : null,
        camera_type: video.editForm.camera_type || null,
      };

      await updateMetadata(video.id, updateData);
      video.saved = true;
      
      // Remove from list after a short delay
      setTimeout(() => {
        videos = videos.filter(v => v.id !== video.id);
      }, 1500);
    } catch (err) {
      video.saveError = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      video.saving = false;
    }
  }

  onMount(() => {
    fetchVideos();
  });
</script>

<div class="p-6">
  <h1 class="text-2xl font-bold text-gray-900 mb-2">Review Queue</h1>
  <p class="text-gray-600 mb-6">
    Videos that need manual review. Correct the metadata and save to move them to "new" status.
  </p>

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      {error}
    </div>
  {:else if videos.length === 0}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
      <p class="font-medium">All caught up!</p>
      <p class="text-sm mt-1">No videos need review at this time.</p>
    </div>
  {:else}
    <div class="space-y-6">
      {#each videos as video}
        <div class="bg-white rounded-lg shadow-md overflow-hidden {video.saved ? 'opacity-50' : ''}">
          <div class="p-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img 
                src="https://img.youtube.com/vi/{video.youtube_id}/mqdefault.jpg" 
                alt="Thumbnail"
                class="w-20 h-14 object-cover rounded"
              />
              <div>
                <h3 class="font-medium text-gray-900 truncate max-w-md">{video.original_title}</h3>
                <a 
                  href="https://www.youtube.com/watch?v={video.youtube_id}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="text-sm text-pink-600 hover:text-pink-800"
                >
                  Watch on YouTube
                </a>
              </div>
            </div>
            {#if video.saved}
              <span class="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                ✓ Saved
              </span>
            {/if}
          </div>

          <div class="p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AutocompleteInput
                label="Performance Date (YYMMDD)"
                type="groups"
                placeholder="e.g., 240315"
                bind:value={video.editForm.perf_date}
              />
              <AutocompleteInput
                label="Group Name"
                type="groups"
                placeholder="Enter group name"
                bind:value={video.editForm.group_name}
              />
              <AutocompleteInput
                label="Artist Name"
                type="artists"
                placeholder="Enter artist name"
                bind:value={video.editForm.artist_name}
              />
              <AutocompleteInput
                label="Song Title"
                type="songs"
                placeholder="Enter song title"
                bind:value={video.editForm.song_title}
              />
              <AutocompleteInput
                label="Event"
                type="events"
                placeholder="Enter event name"
                bind:value={video.editForm.event}
              />
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Camera Type</label>
                <input
                  type="text"
                  bind:value={video.editForm.camera_type}
                  placeholder="e.g., FANCAM"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
            </div>

            {#if video.saveError}
              <div class="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
                {video.saveError}
              </div>
            {/if}

            <div class="mt-4">
              <button
                on:click={() => handleSave(video)}
                disabled={video.saving || video.saved}
                class="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {video.saving ? 'Saving...' : video.saved ? 'Saved!' : 'Save & Move to New'}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
