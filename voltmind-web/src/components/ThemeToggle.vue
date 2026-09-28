<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { isDark, toggleDark } from '@/composables/use-theme'

const label = () => (isDark.value ? '切换到浅色模式' : '切换到深色模式')
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="label()"
    :title="label()"
    :aria-pressed="isDark"
    @click="toggleDark()"
  >
    <Moon v-if="isDark" />
    <Sun v-else />
  </Button>
</template>
