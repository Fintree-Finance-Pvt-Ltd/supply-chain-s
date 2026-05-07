import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { supplierService } from '../../services/supplierService'
import { useSelector } from 'react-redux'
import { ROLES } from '../../constants/roles'

const SupplierCreate = () => {
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    customerId: '',
    mobileNumber: '',
    gstNumber: '',
    supplierName: '',
  })

  // Fetch approved customers on mount
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await supplierService.getApprovedCustomers()
      setCustomers(res.data?.data || [])
    } catch (e) {
      console.error('Failed to fetch customers:', e)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const isOpsL1 = user?.role === ROLES.OPERATIONS_TEAM_L1

  const submit = async () => {
    try {
      // Validation
      if (!form.customerId) {
        return toast.error('Please select a Customer')
      }

      if (!form.mobileNumber.trim()) {
        return toast.error('Mobile Number required')
      }

      if (!form.gstNumber.trim()) {
        return toast.error('GST Number required')
      }

        if (!form.supplierName.trim()) {
        return toast.error('Supplier Name required')
      }
      const payload = {
        customerId: Number(form.customerId),
        supplierName: form.supplierName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        address: null,
        gstNumber: form.gstNumber?.trim() || null,
        bankAccountNumber: '',
        ifscCode: '',
        bankName: '',
        accountHolderName: '',
      }

      let res

      if (isOpsL1) {
        // Ops L1 creates supplier - goes to Ops Head
        res = await supplierService.opsL1CreateSupplier(payload)
        toast.success('Supplier created & moved to Ops Head')
      } else {
        // RM creates supplier - stays in draft
        res = await supplierService.rmCreateSupplier(payload)
        toast.success('Supplier created in Draft status')
      }

      const supplierId = res?.data?.data?.supplier?.id

      if (supplierId) {
        navigate(`/operations/suppliers/${supplierId}`)
      }

    } catch (e) {
      console.error('Create error:', e)
      toast.error(
        e?.response?.data?.message || 'Failed to create supplier'
      )
    }
  }

  return (
    <div className="p-6 max-w-2xl bg-white shadow rounded-lg">
      <h2 className="text-xl font-semibold mb-4">
        {isOpsL1 ? 'Create Supplier (Ops L1)' : 'Create Supplier (RM)'}
      </h2>

      {/* Customer Dropdown */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Customer (LAN) *</label>
        <select
          className="w-full border p-2 rounded"
          value={form.customerId}
          onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          disabled={loading}
        >
          <option value="">Select Customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.companyName || c.customerName} - {c.lanId}
            </option>
          ))}
        </select>
      </div>

      <input
        placeholder="Mobile Number *"
        className="w-full border p-2 rounded mb-3"
        value={form.mobileNumber}
          maxLength={10}

        onChange={(e) =>{
          // setForm({ ...form, mobileNumber: e.target.value })
           const value = e.target.value.replace(/\D/g, ""); // allow only digits
    if (value.length <= 10) {
      setForm({ ...form, mobileNumber: value });
    }
        }}
      />

      <input
        placeholder="GST Number *"
        className="w-full border p-2 rounded mb-3"
        value={form.gstNumber}
        onChange={(e) =>
          setForm({ ...form, gstNumber: e.target.value })
        }
      />
      
 <input
        placeholder="Supplier Name *"
        className="w-full border p-2 rounded mb-3"
        value={form.supplierName}
        onChange={(e) =>
          setForm({ ...form, supplierName: e.target.value })
        }
      />
      <button
        onClick={submit}
        className="bg-primary-600 text-white px-4 py-2 rounded-lg"
        disabled={loading}
      >
        {isOpsL1 ? 'Save & Move to Ops Head' : 'Save (Draft)'}
      </button>
    </div>
  )
}

export default SupplierCreate
