import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { Home, LogIn, LogOut, User, Sparkles, BookOpen, BarChart3 } from 'lucide-react'

export default function NavBar() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    toast({
      title: 'Success',
      description: 'Logged out successfully',
    })
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-purple-600 group-hover:rotate-12 transition-transform duration-300" />
              <div className="absolute inset-0 bg-purple-600 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Quiztastic
            </span>
            <span className="text-xs text-gray-500 font-normal">v 0.0.2</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                className="relative group"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
                {isActive('/') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 animate-pulse" />
                )}
              </Button>
            </Link>
            {user && (
              <>
                <Link to="/my-quizzes">
                  <Button
                    variant={isActive('/my-quizzes') ? 'default' : 'ghost'}
                    className="relative group"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    My Quizzes
                    {isActive('/my-quizzes') && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 animate-pulse" />
                    )}
                  </Button>
                </Link>
                <Link to="/analytics">
                  <Button
                    variant={isActive('/analytics') ? 'default' : 'ghost'}
                    className="relative group"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                    {isActive('/analytics') && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 animate-pulse" />
                    )}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 border border-purple-200">
                  <User className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {user.name}
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="group hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button
                  variant="default"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="sm:hidden">Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

