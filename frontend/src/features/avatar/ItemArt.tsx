import { useId } from 'react'
import { asset, type Item } from './catalog'

export function ItemArt({ item, className = '' }: { item: Item; className?: string }) {
  const [x, y, width, height] = item.crop
  const [imageWidth, imageHeight] = item.imageSize ?? [1448, 1086]
  const clip = useId()
  return (
    <svg className={`av-item-art ${className}`} viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true">
      <defs><clipPath id={clip}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
      <image clipPath={`url(#${clip})`} href={asset(item.sheet)} width={imageWidth} height={imageHeight} />
    </svg>
  )
}
