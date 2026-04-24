<script lang="ts">
  import { onMount } from 'svelte';
  import { getDictionary } from '../api';

  export let value: string = '';
  export let type: 'groups' | 'artists' | 'songs' | 'events' = 'groups';
  export let placeholder: string = '';
  export let label: string = '';
  
  let suggestions: string[] = [];
  let showSuggestions: boolean = false;
  let selectedIndex: number = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    
    if (debounceTimer) clearTimeout(debounceTimer);
    
    if (value.length >= 2) {
      debounceTimer = setTimeout(() => {
        fetchSuggestions(value);
      }, 200);
    } else {
      suggestions = [];
      showSuggestions = false;
    }
  }

  async function fetchSuggestions(query: string) {
    try {
      const response = await getDictionary(type, query);
      suggestions = response.results;
      showSuggestions = suggestions.length > 0;
      selectedIndex = -1;
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }

  function selectSuggestion(suggestion: string) {
    value = suggestion;
    suggestions = [];
    showSuggestions = false;
    selectedIndex = -1;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (event.key === 'Escape') {
      showSuggestions = false;
      suggestions = [];
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.autocomplete-container')) {
      showSuggestions = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="autocomplete-container relative">
  {#if label}
    <label class="block text-sm font-medium text-gray-700 mb-1">{label}</label>
  {/if}
  <input
    type="text"
    bind:value
    on:input={handleInput}
    on:keydown={handleKeydown}
    placeholder={placeholder}
    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
    list="{type}-list"
  />
  
  {#if showSuggestions && suggestions.length > 0}
    <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
      {#each suggestions as suggestion, index}
        <button
          type="button"
          class="w-full text-left px-4 py-2 hover:bg-pink-50 {index === selectedIndex ? 'bg-pink-100' : ''}"
          on:click={() => selectSuggestion(suggestion)}
        >
          {suggestion}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete-container input:focus + div,
  .autocomplete-container div:hover {
    display: block;
  }
</style>
