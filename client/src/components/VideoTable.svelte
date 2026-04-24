<script lang="ts">
  import { onMount } from 'svelte';
  import { getVideos, type Video, type Pagination } from '../api';

  let videos: Video[] = [];
  let pagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
  let loading: boolean = true;
  let error: string | null = null;
  
  let statusFilter: string = '';
  let currentPage: number = 1;
  const limit: number = 20;

  const statusOptions = [
    { value: '', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'needs_review', label: 'Needs Review' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'ready', label: 'Ready' },
    { value: 'completed', label: 'Completed' },
    { value: 'error', label: 'Error' },
  ];

  async function fetchVideos() {
    loading = true;
    error = null;
    try {
      const response = await getVideos({
        status: statusFilter || undefined,
        page: currentPage,
        limit,
      });
      videos = response.videos;
      pagination = response.pagination;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to fetch videos';
    } finally {
      loading = false;
    }
  }

  function handleStatusChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    statusFilter = target.value;
    currentPage = 1;
    fetchVideos();
  }

  function goToPage(page: number) {
    if (page < 1 || page > pagination.totalPages) return;
    currentPage = page;
    fetchVideos();
  }

  function navigateToVideo(id: string) {
    window.location.href = `/videos/${id}`;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'new': return 'bg-green-100 text-green-800';
      case 'needs_review': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  onMount(() => {
    fetchVideos();
  });
</script>

<div class="p-6">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Video Library</h1>
  
  <!-- Filters -->
  <div class="mb-6 flex items-center gap-4">
    <label for="status-filter" class="text-sm font-medium text-gray-700">Status:</label>
    <select
      id="status-filter"
      value={statusFilter}
      on:change={handleStatusChange}
      class="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
    >
      {#each statusOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      {error}
    </div>
  {:else}
    <!-- Table -->
    <div class="overflow-x-auto bg-white rounded-lg shadow">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thumbnail</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Title</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artist</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Song</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each videos as video}
            <tr 
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              on:click={() => navigateToVideo(video.id)}
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <img 
                  src="https://img.youtube.com/vi/{video.youtube_id}/mqdefault.jpg" 
                  alt="Thumbnail"
                  class="w-24 h-18 object-cover rounded"
                />
              </td>
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900 truncate max-w-xs">{video.original_title}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">{video.group_name || '-'}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">{video.artist_name || '-'}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">{video.song_title || '-'}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(video.status)}">
                  {video.status}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-500">{formatDate(video.created_at)}</span>
              </td>
            </tr>
          {/each}
          
          {#if videos.length === 0}
            <tr>
              <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                No videos found
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if pagination.totalPages > 1}
      <div class="mt-6 flex justify-center items-center gap-2">
        <button
          disabled={currentPage === 1}
          on:click={() => goToPage(currentPage - 1)}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span class="text-sm text-gray-700">
          Page {currentPage} of {pagination.totalPages}
        </span>
        
        <button
          disabled={currentPage === pagination.totalPages}
          on:click={() => goToPage(currentPage + 1)}
          class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>
