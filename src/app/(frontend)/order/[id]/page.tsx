import { OrderView, orderMetadata } from '@/views/order'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const generateMetadata = orderMetadata

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams

  return <OrderView id={id} submitted={query.submitted === '1'} />
}
