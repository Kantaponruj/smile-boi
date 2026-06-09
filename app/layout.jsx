import './globals.css'

export const metadata = {
  title: 'smileChatBot — Demo',
  description: 'Evidence-Gated AI Intent Tagging Engine for LINE OA',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Noto Sans Thai', sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
