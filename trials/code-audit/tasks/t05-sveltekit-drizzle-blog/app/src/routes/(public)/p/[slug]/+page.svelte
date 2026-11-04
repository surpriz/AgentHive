<script lang="ts">
  let { data } = $props();
</script>

<article>
  <h1>{data.title}</h1>
  <p><small>by {data.author}</small></p>
  {@html data.html}
</article>
