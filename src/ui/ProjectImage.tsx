import { useProjectImageUrl } from './projectFileHooks'

/** Thumbnail of an image stored in the project. */
export function ProjectImage({
  path,
  alt,
  className,
}: {
  path: string
  alt: string
  className?: string
}) {
  const url = useProjectImageUrl(path)

  return url ? (
    <img className={className} src={url} alt={alt} draggable={false} />
  ) : (
    <span className={`${className ?? ''} image-placeholder`} aria-label={alt} role="img" />
  )
}
