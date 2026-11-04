<script lang="ts">
  let { data, form } = $props();
</script>

<h1>Edit</h1>
<form method="POST" action="?/save">
  <input name="title" value={data.post.title} maxlength="200" required />
  <textarea name="body" rows="20">{data.post.body}</textarea>
  <button>Save draft</button>
  {#if form?.message}<p>{form.message}</p>{/if}
  {#if form?.saved}<p>Saved.</p>{/if}
</form>
{#if !data.post.published}
  <form method="POST" action="?/publish"><button>Publish</button></form>
{/if}
