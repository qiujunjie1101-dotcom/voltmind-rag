<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-card text-card-foreground border-border flex flex-col gap-4 rounded-xl border py-5 shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
