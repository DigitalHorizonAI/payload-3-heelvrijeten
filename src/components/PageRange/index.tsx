import React from 'react'

const defaultLabels = {
  plural: 'Documenten',
  singular: 'Document',
}

const defaultCollectionLabels = {
  posts: {
    plural: 'Artikelen',
    singular: 'Artikel',
  },
}

export const PageRange: React.FC<{
  className?: string
  collection?: string
  collectionLabels?: {
    plural?: string
    singular?: string
  }
  currentPage?: number
  limit?: number
  totalDocs?: number
}> = (props) => {
  const {
    className,
    collection,
    collectionLabels: collectionLabelsFromProps,
    currentPage,
    limit,
    totalDocs,
  } = props

  let indexStart = (currentPage ? currentPage - 1 : 1) * (limit || 1) + 1
  if (totalDocs && indexStart > totalDocs) indexStart = 0

  let indexEnd = (currentPage || 1) * (limit || 1)
  if (totalDocs && indexEnd > totalDocs) indexEnd = totalDocs

  const { plural, singular } =
    collectionLabelsFromProps || defaultCollectionLabels[collection || ''] || defaultLabels || {}

  return (
    <div className={[className, 'font-semibold'].filter(Boolean).join(' ')}>
      {(typeof totalDocs === 'undefined' || totalDocs === 0) && 'Geen artikelen gevonden.'}
      {typeof totalDocs !== 'undefined' &&
        totalDocs > 0 &&
        `Toont ${indexStart}${indexStart > 0 ? ` - ${indexEnd}` : ''} van ${totalDocs} ${
          totalDocs > 1 ? plural : singular
        }`}
    </div>
  )
}
