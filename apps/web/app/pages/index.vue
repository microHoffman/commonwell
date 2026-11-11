<script setup lang="ts">
const { data, isLoading, error, isFetching, refetch } = useDirectory()
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
    <section class="max-w-2xl space-y-3 pt-6">
      <h1 class="text-3xl font-semibold tracking-tight text-balance text-highlighted sm:text-4xl">Fund a community with your yield</h1>
      <p class="text-lg text-muted">Deposit into a community's vault. The yield it earns goes to the community, and your deposit stays yours to withdraw anytime.</p>
    </section>

    <section class="space-y-4">
      <UTabs
        v-if="unreviewed.length > 0"
        v-model="tab"
        :items="tabs"
        :content="false"
        color="neutral"
        class="w-full sm:w-fit"
        :ui="{ list: 'rounded-full bg-default ring ring-default', indicator: 'rounded-full bg-elevated', trigger: 'px-4 data-[state=active]:text-highlighted' }"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        title="Couldn't load communities"
        :description="errorMessage(error)"
        :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', loading: isFetching, onClick: () => refetch() }]"
      />
      <!-- A chain that didn't answer only hides its own communities: the others still show below. -->
      <UAlert
        v-else-if="data?.unavailable.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="`Couldn't read ${data.unavailable.join(' and ')}`"
        description="Communities there are missing until it responds again."
        :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', loading: isFetching, onClick: () => refetch() }]"
      />
      <div v-if="isLoading" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-60 rounded-[1.5rem]" />
      </div>
      <template v-else-if="error" />
      <!-- With a chain missing, an empty list is a guess, so the warning above stands alone. -->
      <UEmpty
        v-else-if="shown.length === 0 && !data?.unavailable.length"
        icon="i-lucide-users"
        title="No communities yet"
        :actions="[{ label: 'Create a community', to: '/new' }]"
      />
      <div v-else-if="shown.length > 0" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CommunityCard v-for="community in shown" :key="community.id" :community="community" />
      </div>
    </section>

    <p class="border-t border-default pt-5 text-sm text-muted">
      Run a community?
      <ULink to="/new" class="font-medium text-primary">Add your community</ULink>
    </p>
  </div>
</template>
