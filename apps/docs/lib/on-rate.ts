'use server'

import { ActionResponse, Feedback } from '@/components/feedback'
import { Octokit, App } from 'octokit'

const repo = 'open-evals'
const owner = 'cantemizyurek'
const DocsCategory = 'Docs Feedback'

interface RepositoryInfo {
  id: string
  discussionCategories: {
    nodes: {
      id: string
      name: string
    }[]
  }
}

export async function onRateAction(
  url: string,
  feedback: Feedback
): Promise<ActionResponse> {
  const octokit = await getOctokit()
  const destination = await getFeedbackDestination()
  if (!octokit || !destination)
    throw new Error('GitHub comment integration is not configured.')
  const category = destination.discussionCategories.nodes.find(
    (category) => category.name === DocsCategory
  )
  if (!category)
    throw new Error(
      `Please create a "${DocsCategory}" category in GitHub Discussion`
    )
  const title = `Feedback for ${url}`
  const body = `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.`
  let {
    search: {
      nodes: [discussion],
    },
  }: {
    search: {
      nodes: { id: string; url: string }[]
    }
  } = await octokit.graphql(`
            query {
              search(type: DISCUSSION, query: ${JSON.stringify(
                `${title} in:title repo:${owner}/${repo} author:@me`
              )}, first: 1) {
                nodes {
                  ... on Discussion { id, url }
                }
              }
            }`)
  if (discussion) {
    await octokit.graphql(`
              mutation {
                addDiscussionComment(input: { body: ${JSON.stringify(
                  body
                )}, discussionId: "${discussion.id}" }) {
                  comment { id }
                }
              }`)
  } else {
    const result: {
      createDiscussion: {
        discussion: { id: string; url: string }
      }
    } = await octokit.graphql(`
              mutation {
                createDiscussion(input: { repositoryId: "${
                  destination.id
                }", categoryId: "${category!.id}", body: ${JSON.stringify(
      body
    )}, title: ${JSON.stringify(title)} }) {
                  discussion { id, url }
                }
              }`)
    discussion = result.createDiscussion.discussion
  }
  return {
    githubUrl: discussion.url,
  }
}

let cachedFeedbackDestination: RepositoryInfo | undefined
async function getFeedbackDestination() {
  if (cachedFeedbackDestination) return cachedFeedbackDestination
  const octokit = await getOctokit()

  const {
    repository,
  }: {
    repository: RepositoryInfo
  } = await octokit.graphql(`
  query {
    repository(owner: "${owner}", name: "${repo}") {
      id
      discussionCategories(first: 25) {
        nodes { id name }
      }
    }
  }
`)

  cachedFeedbackDestination = repository
  return cachedFeedbackDestination
}

async function getOctokit(): Promise<Octokit> {
  if (getOctokit.instance) return getOctokit.instance

  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set')
  }

  const app = new App({
    appId,
    privateKey: privateKey,
  })

  const { data } = await app.octokit.request(
    'GET /repos/{owner}/{repo}/installation',
    {
      owner,
      repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  getOctokit.instance = await app.getInstallationOctokit(data.id)

  return getOctokit.instance
}

namespace getOctokit {
  export let instance: Octokit | undefined
}
