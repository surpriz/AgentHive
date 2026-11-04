<script lang="ts">
  let { data } = $props();
</script>

<h1>inkwell</h1>
<ul>
  {#each data.posts as post}
    <li><a href="/p/{post.slug}">{post.title}</a> <small>by {post.author}</small></li>
  {/each}
</ul>
