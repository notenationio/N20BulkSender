import siteMetadata from '@/data/siteMetadata'
import App from './app'

const MAX_DISPLAY = 5

export default function Home() {
  return (
    <>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <div className="space-y-2 pb-8 pt-6 md:space-y-5">
          <p className="text-md leading-7 text-gray-500 dark:text-gray-400">
            {siteMetadata.description}
          </p>
        </div>
      </div>
      <App />
    </>
  )
}
