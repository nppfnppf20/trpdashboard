<script>
  import { createEventDispatcher } from 'svelte';
  
  export let rating = 0; // Rating value (0-5, supports 0.5 increments)
  export let readonly = false; // Now interactive by default
  
  const dispatch = createEventDispatcher();
  let hoverRating = 0;
  
  // Display rating or hover preview
  $: displayRating = hoverRating || rating;
  $: fullStars = Math.floor(displayRating);
  $: hasHalfStar = (displayRating % 1) >= 0.25 && (displayRating % 1) < 0.75;
  
  function handleClick(starIndex, event) {
    if (!readonly) {
      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const isLeftHalf = clickX < rect.width / 2;
      
      const newRating = isLeftHalf ? starIndex - 0.5 : starIndex;
      rating = newRating;
      dispatch('change', { rating: newRating });
    }
  }
  
  function handleMouseMove(starIndex, event) {
    if (!readonly) {
      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const isLeftHalf = mouseX < rect.width / 2;
      
      hoverRating = isLeftHalf ? starIndex - 0.5 : starIndex;
    }
  }
  
  function handleMouseLeave() {
    if (!readonly) {
      hoverRating = 0;
    }
  }
</script>

<div class="star-rating" class:readonly class:interactive={!readonly} on:mouseleave={handleMouseLeave}>
  {#each Array(5) as _, i}
    {#if i < fullStars}
      <i 
        class="las la-star filled" 
        on:click={(e) => handleClick(i + 1, e)}
        on:mousemove={(e) => handleMouseMove(i + 1, e)}
        role={readonly ? 'presentation' : 'button'}
        tabindex={readonly ? -1 : 0}
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(i + 1, e); }}
      ></i>
    {:else if hasHalfStar && i === fullStars}
      <i 
        class="las la-star-half-alt filled" 
        on:click={(e) => handleClick(i + 1, e)}
        on:mousemove={(e) => handleMouseMove(i + 1, e)}
        role={readonly ? 'presentation' : 'button'}
        tabindex={readonly ? -1 : 0}
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(i + 1, e); }}
      ></i>
    {:else}
      <i 
        class="lar la-star empty" 
        on:click={(e) => handleClick(i + 1, e)}
        on:mousemove={(e) => handleMouseMove(i + 1, e)}
        role={readonly ? 'presentation' : 'button'}
        tabindex={readonly ? -1 : 0}
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(i + 1, e); }}
      ></i>
    {/if}
  {/each}
</div>

<style>
  .star-rating {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font-size: 1.125rem;
  }
  
  .star-rating i {
    color: #fbbf24;
  }
  
  .star-rating i.filled {
    color: #f59e0b;
  }
  
  .star-rating i.empty {
    color: #d1d5db;
  }
  
  /* Interactive mode */
  .star-rating.interactive i {
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .star-rating.interactive i:hover {
    transform: scale(1.15);
  }
  
  .star-rating.interactive i:active {
    transform: scale(1.05);
  }
</style>
