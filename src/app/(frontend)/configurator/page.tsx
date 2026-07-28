import { ConfiguratorView } from '@/views/configurator'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ConfiguratorPage({ searchParams }: Props) {
  return <ConfiguratorView searchParams={await searchParams} />
}
