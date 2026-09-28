import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Staging-only marketing-sourced pipeline forecasting workspace.',
  title: 'Marketing Campaign Forecaster',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
