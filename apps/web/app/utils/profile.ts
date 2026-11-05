import { safeHttpUrl, type Profile } from '@commonwell/core'

export function emptyProfile(): Profile {
  return { name: '', description: '', website: '', imageURI: '' }
}

export function trimProfile(profile: Profile): Profile {
  return {
    name: profile.name.trim(),
    description: profile.description.trim(),
    website: profile.website.trim(),
    imageURI: profile.imageURI.trim(),
  }
}

export function profileErrors(profile: Profile): Partial<Record<keyof Profile, string>> {
  const p = trimProfile(profile)
  return {
    name: !p.name ? 'Required' : p.name.length > 64 ? 'At most 64 characters' : undefined,
    description: p.description.length > 500 ? 'At most 500 characters' : undefined,
    website: p.website && !safeHttpUrl(p.website) ? 'Use an https:// link' : undefined,
    imageURI: p.imageURI && !safeHttpUrl(p.imageURI) ? 'Use an https:// link' : undefined,
  }
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}
