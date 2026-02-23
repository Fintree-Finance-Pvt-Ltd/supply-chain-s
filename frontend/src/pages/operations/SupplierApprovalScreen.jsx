import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import LoadingSpinner from '../../components/LoadingSpinner'
import { toast } from 'react-hot-toast'
import {
    FiCheck, FiX, FiUser, FiHome, FiCreditCard, FiPhone,
    FiArrowLeft, FiClock, FiFileText, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi'

const InfoRow = ({ label, value, mono = false }) => (
    <div className="flex flex-col space-y-0.5">
        <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">{label}</span>
        <span className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>
            {value || <span className="text-gray-300 italic font-normal">—</span>}
        </span>
    </div>
)

const StatusChip = ({ status }) => {
    const map = {
        OPS_L1_APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending Ops Head', icon: FiClock },
        COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Onboarded ✓', icon: FiCheckCircle },
        REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: FiAlertCircle },
        SUBMITTED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending L1', icon: FiClock },
        DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft', icon: FiFileText },
    }
    const s = map[status?.toUpperCase()] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status, icon: FiFileText }
    const Icon = s.icon
    return (
        <span className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
            <Icon size={12} />
            <span>{s.label}</span>
        </span>
    )
}

const SupplierApprovalScreen = () => {
    const { id } = useParams() // supplierId
    const navigate = useNavigate()

    const [supplier, setSupplier] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [remarks, setRemarks] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true)
                const res = await workflowService.getSupplierById(id)
                setSupplier(res.data?.data || null)
            } catch (err) {
                toast.error('Failed to load supplier details')
            } finally {
                setIsLoading(false)
            }
        }
        if (id) load()
    }, [id])

    const handleApprove = async () => {
        setIsSubmitting(true)
        try {
            await workflowService.approveSupplierOpsHead(id, true, remarks)
            toast.success('🎉 Supplier successfully onboarded!')
            navigate('/operations/dashboard')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Approval failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReject = async () => {
        if (!remarks.trim()) return toast.error('Please provide a rejection reason')
        setIsSubmitting(true)
        try {
            await workflowService.approveSupplierOpsHead(id, false, remarks)
            toast.success('Supplier rejected.')
            navigate('/operations/dashboard')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rejection failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <div className="flex items-center justify-center min-h-96"><LoadingSpinner /></div>
    if (!supplier) return (
        <div className="text-center py-20 text-gray-400">
            <FiAlertCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-semibold">Supplier not found</p>
        </div>
    )

    const isActive = supplier.status === 'OPS_L1_APPROVED'

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => navigate('/operations/dashboard')}
                        className="flex items-center space-x-1.5 text-sm text-gray-500 hover:text-primary-600 mb-3 transition-colors"
                    >
                        <FiArrowLeft size={14} />
                        <span>Back to Dashboard</span>
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Supplier Review</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Review supplier details submitted by Operations L1 and take action.
                    </p>
                </div>
                <StatusChip status={supplier.status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left — Details */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Linked Customer */}
                    <div className="card shadow-sm border-t-4 border-indigo-400">
                        <h2 className="flex items-center text-base font-bold text-gray-700 mb-5 uppercase tracking-wider">
                            <FiHome className="mr-2 text-indigo-500" /> Linked Customer
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                            <InfoRow label="Customer Name" value={supplier.customer?.customerName} />
                            <InfoRow label="LAN ID" value={supplier.customer?.lanId} mono />
                            <InfoRow label="Customer Code" value={supplier.customer?.customerCode} mono />
                        </div>
                    </div>

                    {/* Supplier Basic Info */}
                    <div className="card shadow-sm border-t-4 border-primary-400">
                        <h2 className="flex items-center text-base font-bold text-gray-700 mb-5 uppercase tracking-wider">
                            <FiUser className="mr-2 text-primary-500" /> Supplier Details
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                            <InfoRow label="Supplier Name" value={supplier.supplierName} />
                            <InfoRow label="Mobile Number" value={supplier.contactNumber} />
                            <InfoRow label="GST Number" value={supplier.gstNumber} mono />
                            <InfoRow label="Supplier Code" value={supplier.supplierCode} mono />
                            <InfoRow label="Email" value={supplier.email} />
                            <InfoRow label="PAN Number" value={supplier.panNumber} mono />
                        </div>
                    </div>

                    {/* Bank Details */}
                    <div className="card shadow-sm border-t-4 border-emerald-400">
                        <h2 className="flex items-center text-base font-bold text-gray-700 mb-5 uppercase tracking-wider">
                            <FiCreditCard className="mr-2 text-emerald-500" /> Bank / Settlement Details
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                            <InfoRow label="Account Holder" value={supplier.accountHolderName} />
                            <InfoRow label="Account Number" value={supplier.bankAccountNumber} mono />
                            <InfoRow label="Bank Name" value={supplier.bankName} />
                            <InfoRow label="IFSC Code" value={supplier.ifscCode} mono />
                        </div>

                        {/* Cheque Preview */}
                        {supplier.cancelledChequeUrl && (
                            <div className="mt-5 pt-5 border-t border-gray-100">
                                <p className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Cancelled Cheque</p>
                                <a href={supplier.cancelledChequeUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={supplier.cancelledChequeUrl}
                                        alt="Cancelled Cheque"
                                        className="max-h-40 rounded-lg shadow ring-2 ring-emerald-200 hover:ring-primary-400 transition-all cursor-pointer"
                                    />
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Timeline / History */}
                    {supplier.statusHistory?.length > 0 && (
                        <div className="card shadow-sm">
                            <h2 className="flex items-center text-base font-bold text-gray-700 mb-4 uppercase tracking-wider">
                                <FiClock className="mr-2 text-gray-400" /> Activity Timeline
                            </h2>
                            <div className="space-y-3">
                                {supplier.statusHistory.map((h, i) => (
                                    <div key={i} className="flex items-start space-x-3">
                                        <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 flex-shrink-0 ring-4 ring-primary-50"></div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-700 uppercase">
                                                {h.status?.replace(/_/g, ' ')} ← {h.previousStatus?.replace(/_/g, ' ')}
                                            </p>
                                            {h.remarks && <p className="text-xs text-gray-500 mt-0.5 italic">"{h.remarks}"</p>}
                                            <p className="text-[10px] text-gray-300 mt-0.5">
                                                {h.createdAt ? new Date(h.createdAt).toLocaleString('en-IN') : ''}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right — Action Panel */}
                <div className="space-y-5">
                    <div className="card shadow-md border border-gray-100 sticky top-24">
                        <h2 className="text-base font-bold text-gray-700 mb-4 uppercase tracking-wider">Operations Head Action</h2>

                        {isActive ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-400 tracking-wider block mb-1.5">
                                        Remarks
                                    </label>
                                    <textarea
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        rows={4}
                                        className="input-field text-sm resize-none"
                                        placeholder="Add your remarks here (required for rejection)..."
                                    />
                                </div>

                                <button
                                    onClick={handleApprove}
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition-all shadow-lg shadow-green-100 hover:shadow-green-200"
                                >
                                    {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : (
                                        <>
                                            <FiCheck size={18} />
                                            <span>Approve & Onboard Supplier</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleReject}
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-600 font-bold py-3 px-6 rounded-xl hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-all"
                                >
                                    {isSubmitting ? <LoadingSpinner size="sm" /> : (
                                        <>
                                            <FiX size={18} />
                                            <span>Reject</span>
                                        </>
                                    )}
                                </button>

                                <p className="text-xs text-gray-400 text-center leading-relaxed">
                                    Approving will mark this supplier as <strong>Onboarded</strong> and allow invoice discounting.
                                </p>
                            </div>
                        ) : (
                            <div className={`p-4 rounded-xl text-center space-y-2 ${supplier.status === 'COMPLETED' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
                                }`}>
                                {supplier.status === 'COMPLETED' ? (
                                    <>
                                        <FiCheckCircle className="mx-auto text-green-500" size={32} />
                                        <p className="font-bold text-green-700">Supplier Successfully Onboarded</p>
                                        <p className="text-xs text-green-500">This supplier is active and ready for invoice discounting.</p>
                                    </>
                                ) : (
                                    <>
                                        <FiAlertCircle className="mx-auto text-red-400" size={32} />
                                        <p className="font-bold text-red-600">Supplier Rejected</p>
                                        {supplier.rejectionReason && (
                                            <p className="text-xs text-red-400 italic">"{supplier.rejectionReason}"</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SupplierApprovalScreen
