<script lang="ts">
  import Router from 'svelte-spa-router';
  import VideoTable from './components/VideoTable.svelte';
  import VideoCard from './components/VideoCard.svelte';
  import ReviewQueue from './components/ReviewQueue.svelte';
  import { link } from 'svelte-spa-router';

  const routes = {
    '/videos': VideoTable,
    '/videos/:id': VideoCard,
    '/review': ReviewQueue,
    '*': VideoTable, // Default to videos page
  };
</script>

<div class="min-h-screen bg-gray-100">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-pink-600">K-pop Archive Manager</h1>
        </div>
        <div class="flex items-center space-x-4">
          <a
            href="/videos"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            use:link
          >
            Videos
          </a>
          <a
            href="/review"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            use:link
          >
            Review Queue
          </a>
          <span
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-400 cursor-not-allowed"
            title="Coming soon"
          >
            Dashboard
          </span>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="container mx-auto p-4">
    <Router {routes} />
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  }
</style>
