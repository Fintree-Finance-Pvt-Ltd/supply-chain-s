import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import { kycService } from '../../services/kycService'
import LoadingSpinner from '../../components/LoadingSpinner'
import { FiSave, FiUpload, FiCheck, FiInfo, FiTrash2, FiUser, FiHome, FiPhone, FiCreditCard } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

const SupplierOnboarding = () => {
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [customers, setCustomers] = useState([])
    const [isOcrLoading, setIsOcrLoading] = useState(false)

    const [formData, setFormData] = useState({
        customerId: '',
        supplierName: '',
        mobileNumber: '',
        gstNumber: '',
        bankAccountNumber: '',
        ifscCode: '',
        bankName: '',
        accountHolderName: '',
        cancelledChequeUrl: ''
    })

    const [chequeFile, setChequeFile] = useState(null)
    const [chequePreview, setChequePreview] = useState(null)

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const response = await workflowService.getSanctionedCustomers()
                const data = response.data?.data || []
                setCustomers(data)

                if (data.length === 0) {
                    console.log('No sanctioned customers found')
                }
            } catch (error) {
                console.error('Error fetching customers:', error)
                toast.error('Failed to load sanctioned customers')
            }
        }
        fetchCustomers()
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setChequeFile(file)
            setChequePreview(URL.createObjectURL(file))
            handleOcr(file)
        }
    }

    const handleOcr = async (file) => {
        setIsOcrLoading(true)
        try {
            const result = await kycService.runOcr(file, 'cheque')
            if (result.success && result.data) {
                const ocr = result.data
                setFormData(prev => ({
                    ...prev,
                    bankAccountNumber: ocr.accountNumber || prev.bankAccountNumber,
                    ifscCode: ocr.ifsc || prev.ifscCode,
                    bankName: ocr.bankName || prev.bankName,
                    accountHolderName: ocr.name || prev.accountHolderName
                }))
                toast.success('Cheque OCR successful! Details auto-filled.')
            }
        } catch (error) {
            console.error('OCR failed:', error)
            toast.error('OCR failed to extract details, please fill manually.')
        } finally {
            setIsOcrLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.customerId) return toast.error('Please select a customer')

        setIsLoading(true)
        try {
            // In a real app, you'd upload the file to GCS first to get the URL
            // For now, we'll simulate the URL or just send the data
            const payload = {
                ...formData,
                cancelledChequeUrl: chequePreview // Placeholder for the actual uploaded URL
            }

            await workflowService.createSupplier(payload)
            toast.success('Supplier onboarding successful! Case moved to Operations Head.')
            navigate('/operations/dashboard')
        } catch (error) {
            console.error('Onboarding failed:', error)
            toast.error(error.response?.data?.message || 'Onboarding failed')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Supplier Onboarding</h1>
                    <p className="text-gray-500 mt-1 font-medium">Create and onboard a new supplier for an approved customer.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Selection */}
                <div className="card shadow-md border-t-4 border-primary-500">
                    <h2 className="flex items-center text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 uppercase tracking-wider">
                        <FiUser className="mr-2 text-primary-500" /> Customer Information
                    </h2>
                    <div className="w-full">
                        <label className="label-text">Select Customer (LAN Reference)</label>
                        <select
                            name="customerId"
                            value={formData.customerId}
                            onChange={handleChange}
                            className="input-field mt-1"
                            required
                        >
                            <option value="">-- Select Customer --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.customerName || c.companyName || 'Unnamed Customer'} {c.lanId ? `(${c.lanId})` : ''}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-400 italic">Only customers with an approved LAN ID are shown.</p>
                    </div>
                </div>

                {/* Supplier Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card shadow-md">
                        <h2 className="flex items-center text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 uppercase tracking-wider">
                            <FiHome className="mr-2 text-primary-500" /> Basic Details
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="label-text">Supplier Name</label>
                                <input
                                    type="text"
                                    name="supplierName"
                                    value={formData.supplierName}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="Enter full name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label-text">Mobile Number</label>
                                <div className="relative">
                                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="tel"
                                        name="mobileNumber"
                                        value={formData.mobileNumber}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="10-digit number"
                                        required
                                        pattern="[0-9]{10}"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label-text">GST Number</label>
                                <input
                                    type="text"
                                    name="gstNumber"
                                    value={formData.gstNumber}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="22AAAAA0000A1Z5"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card shadow-md">
                        <h2 className="flex items-center text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 uppercase tracking-wider">
                            <FiUpload className="mr-2 text-indigo-500" /> Cheque OCR Verification
                        </h2>
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${chequePreview ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 bg-gray-50'
                                    }`}>
                                    {chequePreview ? (
                                        <div className="relative inline-block group">
                                            <img src={chequePreview} alt="Cheque" className="max-h-40 rounded shadow-lg ring-4 ring-white" />
                                            <button
                                                type="button"
                                                onClick={() => { setChequePreview(null); setChequeFile(null); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:scale-110 transition-transform"
                                            >
                                                <FiTrash2 size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                                                <FiUpload className="text-primary-500 h-6 w-6" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-700">Upload Cancelled Cheque</p>
                                            <p className="text-xs text-gray-400">PDF, JPG or PNG (max. 5MB)</p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept="image/*,.pdf"
                                    />
                                </div>
                                {isOcrLoading && (
                                    <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center space-y-2 z-10 backdrop-blur-sm">
                                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs font-bold text-primary-600 animate-pulse">Running OCR Engine...</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-lg flex items-start space-x-2 border border-indigo-100">
                                <FiInfo className="text-indigo-500 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-indigo-700 leading-relaxed">
                                    <strong>How it works:</strong> Our AI will scan your cheque to automatically extract the account number, holder name, and IFSC code for precision.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Banking Details */}
                <div className="card shadow-md border-b-4 border-indigo-500">
                    <h2 className="flex items-center text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 uppercase tracking-wider">
                        <FiCreditCard className="mr-2 text-indigo-500" /> Settlement Account Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label-text">Account Holder Name</label>
                            <input
                                type="text"
                                name="accountHolderName"
                                value={formData.accountHolderName}
                                onChange={handleChange}
                                className={`input-field ${isOcrLoading ? 'bg-gray-100' : ''}`}
                                placeholder="As per bank records"
                                required
                            />
                        </div>
                        <div>
                            <label className="label-text">Bank Account Number</label>
                            <input
                                type="text"
                                name="bankAccountNumber"
                                value={formData.bankAccountNumber}
                                onChange={handleChange}
                                className={`input-field ${isOcrLoading ? 'bg-gray-100' : ''}`}
                                placeholder="Enter A/C Number"
                                required
                            />
                        </div>
                        <div>
                            <label className="label-text">Bank Name</label>
                            <input
                                type="text"
                                name="bankName"
                                value={formData.bankName}
                                onChange={handleChange}
                                className={`input-field ${isOcrLoading ? 'bg-gray-100' : ''}`}
                                placeholder="e.g. HDFC Bank"
                                required
                            />
                        </div>
                        <div>
                            <label className="label-text">IFSC Code</label>
                            <input
                                type="text"
                                name="ifscCode"
                                value={formData.ifscCode}
                                onChange={handleChange}
                                className={`input-field uppercase ${isOcrLoading ? 'bg-gray-100' : ''}`}
                                placeholder="HDFC0001234"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end space-x-4 pt-4">
                    <button
                        type="button"
                        onClick={() => navigate('/operations/dashboard')}
                        className="btn-ghost"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || isOcrLoading}
                        className="btn-primary flex items-center space-x-2 px-8 py-3"
                    >
                        {isLoading ? (
                            <LoadingSpinner size="sm" color="white" />
                        ) : (
                            <>
                                <FiCheck size={18} />
                                <span className="font-bold">Save & Move to Ops Head</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default SupplierOnboarding
