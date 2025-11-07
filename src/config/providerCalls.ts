export type NuorbitProviderCallKind = 'registry-permit' | 'custom';

export interface NuorbitProviderCallTemplate {
  id: string;
  label: string;
  description?: string;
  targetChainId: number;
  kind: NuorbitProviderCallKind;
  registryAddress?: string;
}

export function isRegistryProviderCall(
  template: NuorbitProviderCallTemplate,
): template is NuorbitProviderCallTemplate & { registryAddress: string } {
  return template.kind === 'registry-permit' && typeof template.registryAddress === 'string';
}
