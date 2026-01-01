export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-purple-900 mt-auto py-4">
      <div className="max-w-6xl mx-auto px-8 text-center">
        <p className="text-white text-sm">
          {currentYear} | Sayyed Abu Bakr | SID: 2193828
        </p>
      </div>
    </footer>
  )
}

