import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { supplierService } from '../../services/supplierService'
import { useSelector } from 'react-redux'
import { ROLES } from '../../constants/roles'

const SupplierDashboard = () => {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  useEffect(() => {
    fetchSuppliers()
  }, [user?.role, activeTab])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      let res
      const role = user?.role

      // RM sees their own suppliers, Operations sees pending/completed based on tab
      if (role === ROLES.RELATIONSHIP_MANAGER) {
        res = await supplierService.getRMDashboard()
        let allSuppliers = res.data?.data?.suppliers || []
        
        if (activeTab === 'pending') {
          // RM sees DRAFT and SUBMITTED
          allSuppliers = allSuppliers.filter(s => 
            normalizeStatus(s.status) === 'DRAFT' || 
            normalizeStatus(s.status) === 'SUBMITTED'
          )
        } else {
          // RM sees COMPLETED
          allSuppliers = allSuppliers.filter(s => 
            normalizeStatus(s.status) === 'COMPLETED' ||
            normalizeStatus(s.status) === 'REJECTED'
          )
        }
        setSuppliers(allSuppliers)
      } else if (activeTab === 'completed') {
        // For completed tab, get all suppliers
        res = await supplierService.getAllSuppliers()
        let allSuppliers = res.data?.data || []
        // Filter for completed/rejected
        allSuppliers = allSuppliers.filter(s => 
          normalizeStatus(s.status) === 'COMPLETED' ||
          normalizeStatus(s.status) === 'REJECTED'
        )
        setSuppliers(allSuppliers)
      } else {
        // Pending tab - use operations dashboard
        res = await supplierService.getOperationsDashboard()
        let allSuppliers = res.data?.data || []

        // Ops L1 sees DRAFT, Ops Head sees OPS_L1_APPROVED
        if (role === ROLES.OPERATIONS_TEAM_L1) {
          allSuppliers = allSuppliers.filter(s => normalizeStatus(s.status) === 'DRAFT')
        } else if (role === ROLES.OPERATIONS_HEAD) {
          allSuppliers = allSuppliers.filter(s => 
            normalizeStatus(s.status) === 'OPS_L1_APPROVED' ||
            normalizeStatus(s.status) === 'SUBMITTED'
          )
        }
        setSuppliers(allSuppliers)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to fetch suppliers')
    } finally {
      setLoading(false)
    }
  }

  // Normalize status to uppercase for display
  const normalizeStatus = (status) => {
    return status?.toUpperCase() || 'UNKNOWN'
  }

  // Show status badge with colors
  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeStatus(status)
    const statusColors = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'SUBMITTED': 'bg-blue-100 text-blue-800',
      'OPS_L1_APPROVED': 'bg-yellow-100 text-yellow-800',
      'OPS_L1_REJECTED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
    }
    const colorClass = statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800'
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {normalizedStatus}
      </span>
    )
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Supplier Onboarding</h1>

        {(user?.role === ROLES.OPERATIONS_TEAM_L1 || user?.role === ROLES.RELATIONSHIP_MANAGER) && (
          <button
            onClick={() => navigate('/operations/suppliers/create')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg"
          >
            + New Supplier
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 ${activeTab === 'pending' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
        >
          Pending Cases
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2 px-4 ${activeTab === 'completed' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
        >
          Completed/Rejected
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-2xl font-bold">{suppliers.length}</div>
          <div className="text-gray-500">Total Cases</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-2xl font-bold text-gray-800">
            {suppliers.filter(s => normalizeStatus(s.status) === 'DRAFT').length}
          </div>
          <div className="text-gray-500">Draft</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-2xl font-bold text-blue-600">
            {suppliers.filter(s => normalizeStatus(s.status) === 'SUBMITTED' || normalizeStatus(s.status) === 'OPS_L1_APPROVED').length}
          </div>
          <div className="text-gray-500">In Review</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-2xl font-bold text-green-600">
            {suppliers.filter(s => normalizeStatus(s.status) === 'COMPLETED').length}
          </div>
          <div className="text-gray-500">Completed</div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Supplier Name</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">GST</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{s.supplierName}</td>
                <td className="p-3">{s.customer?.name || s.customer?.companyName || s.customer?.customerName || '-'}</td>
                <td className="p-3">{s.contactNumber}</td>
                <td className="p-3">{s.gstNumber || '-'}</td>
                <td className="p-3">{getStatusBadge(s.status)}</td>
                <td className="p-3">
                  <button
                    onClick={() => navigate(`/operations/suppliers/${s.id}`)}
                    className="text-primary-600 hover:underline"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}

            {suppliers.length === 0 && (
              <tr>
                <td colSpan="6" className="p-6 text-center text-gray-500">
                  No supplier cases found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SupplierDashboard
