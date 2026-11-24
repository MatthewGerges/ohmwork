import { LoginForm } from './LoginForm'
import { AdminDashboard } from './AdminDashboard'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) return <LoginForm />
  return <AdminDashboard />
}
