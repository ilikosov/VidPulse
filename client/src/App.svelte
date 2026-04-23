<script lang="ts">
  let count: number = 0

  function increment(): void {
    count += 1
  }
</script>

<main>
  <h1>Welcome to K-pop Archive Manager</h1>
  <p>Manage your K-pop video archive with ease.</p>
  <button on:click={increment}>
    Count: {count}
  </button>
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: sans-serif;
  }
  h1 {
    color: #ff6b9d;
  }
  button {
    background: #ff6b9d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 1rem;
  }
  button:hover {
    background: #ff4785;
  }
</style>
