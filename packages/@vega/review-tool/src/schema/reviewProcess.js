// A ReviewProcess orchestrates one round of reviews (reviewItems) on a single (frozen) article
import {distanceInWordsToNow} from 'date-fns'

export default {
  title: 'Review Process',
  name: 'reviewProcess',
  type: 'document',
  liveEdit: true,
  fields: [
    {
      title: 'Article',
      name: 'article',
      type: 'reference',
      to: [{type: 'article'}]
    },
    {
      title: 'Article Snapshot',
      name: 'articleSnapshot',
      type: 'reference',
      description:
        'A copy of the article, frozen in time the moment this reviewProcess started',
      to: [{type: 'articleSnapshot'}]
    },
    {
      title: 'Completed At',
      name: 'completedAt',
      type: 'datetime'
    },
    {
      title: 'Content',
      name: 'content',
      type: 'reviewBlockContent',
      description: "The editor's conclusive review of the article"
    },
    {
      title: 'Decision',
      name: 'decision',
      type: 'string',
      description: "The editor's conclusive decision",
      options: {
        layout: 'radio',
        list: [
          {title: 'Publish', value: 'publish'},
          {title: 'Publish with Revisions', value: 'publish-with-revisions'},
          {title: 'Reject', value: 'reject'}
        ]
      }
    }
  ],
  preview: {
    select: {
      title: 'article.title',
      createdAt: '_createdAt',
      completedAt: 'completedAt'
    },
    prepare(selection) {
      const {title, completedAt, createdAt} = selection
      const subtitle = completedAt
        ? `Ended ${distanceInWordsToNow(new Date(completedAt))} ago`
        : `Began ${distanceInWordsToNow(new Date(createdAt))} ago`
      return {
        title: title,
        subtitle
      }
    }
  }
}
