<script lang="ts">
  import { goto } from 'svelte-spa-router';

  export let currentRoute: string = '/videos';

  function navigate(path: string) {
    goto(path);
  }
</script>

<nav class="bg-white shadow-sm border-b">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex items-center">
        <h1 class="text-xl font-bold text-pink-600">K-pop Archive Manager</h1>
      </div>
      <div class="flex items-center space-x-4">
        <button
          on:click={() => navigate('/')}
          class="px-3 py-2 rounded-md text-sm font-medium {currentRoute === '/' ? 'bg-pink-100 text-pink-700' : 'text-gray-700 hover:bg-gray-100'}"
        >
          Dashboard
        </button>
        <button
          on:click={() => navigate('/videos')}
          class="px-3 py-2 rounded-md text-sm font-medium {currentRoute === '/videos' || currentRoute?.startsWith('/videos/') ? 'bg-pink-100 text-pink-700' : 'text-gray-700 hover:bg-gray-100'}"
        >
          Videos
        </button>
        <button
          on:click={() => navigate('/review')}
          class="px-3 py-2 rounded-md text-sm font-medium {currentRoute === '/review' ? 'bg-pink-100 text-pink-700' : 'text-gray-700 hover:bg-gray-100'}"
        >
          Review Queue
        </button>
      </div>
    </div>
  </div>
</nav>
