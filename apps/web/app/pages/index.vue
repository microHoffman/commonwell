<script setup lang="ts">
const { data, isLoading, error } = useDirectory()
const tab = ref<'reviewed' | 'unreviewed'>('reviewed')

const communities = computed(() => listed(data.value?.communities))
const reviewed = computed(() => communities.value.filter((c) => c.reviewed))
const unreviewed = computed(() => communities.value.filter((c) => !c.reviewed))
const shown = computed(() => (tab.value === 'reviewed' ? reviewed.value : unreviewed.value))
const tabs = computed(() => [
  { label: `Reviewed (${reviewed.value.length})`, value: 'reviewed' },
  { label: `Unreviewed (${unreviewed.value.length})`, value: 'unreviewed' },
])
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-2">
      <h1 class="text-2xl font-semibold sm:text-3xl">Fund a community with your yield</h1>
      <p class="text-muted">Deposit into a community's vault. The yield it earns goes to the community, and your deposit stays yours to withdraw anytime.</p>
    </section>

    <section class="space-y-4">
      <UTabs v-if="unreviewed.length > 0" v-model="tab" :items="tabs" :content="false" />

      <UAlert v-if="error" color="error" variant="subtle" title="Couldn't load communities" :description="errorMessage(error)" />
      <UAlert
        v-else-if="data?.unavailable.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="`Couldn't read ${data.unavailable.join(' and ')}`"
        description="Communities there are missing until it responds again."
      />
      <div v-else-if="isLoading" class="grid gap-4 sm:grid-cols-2">
        <USkeleton v-for="i in 2" :key="i" class="h-40" />
      </div>
      <UEmpty
        v-else-if="shown.length === 0"
        icon="i-lucide-users"
        title="No communities yet"
        :actions="[{ label: 'Create a community', to: '/new' }]"
      />
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <CommunityCard v-for="community in shown" :key="community.id" :community="community" />
      </div>
    </section>

    <p class="border-t border-default pt-4 text-sm text-muted">
      Run a community?
      <ULink to="/new" class="font-medium text-primary">Add your community</ULink>
    </p>
  </div>
</template>
