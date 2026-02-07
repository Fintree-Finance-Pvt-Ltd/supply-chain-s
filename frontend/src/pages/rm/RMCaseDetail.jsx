import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { fetchCaseById } from '../../store/slices/caseSlice'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import { documentService } from '../../services/documentService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import { formatDate } from '../../utils/format'
import CustomerFullDetails from '../../components/CustomerFullDetails'
import { FiFileText, FiCheck, FiSend, FiFile, FiLock, FiEye } from 'react-icons/fi'

const RMCaseDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.auth)
    const { currentCase, isLoading } = useSelector((state) => state.cases)

    const [bankDetails, setBankDetails] = useState({
        bankAccountNo: '',
        bankIfscCode: '',
        bankName: '',
        bankBranch: '',
        bankType: 'savings', // Default
    })

    const [remarks, setRemarks] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        if (id) {
            dispatch(fetchCaseById(id))
        }
    }, [id, dispatch])

    useEffect(() => {
        if (currentCase) {
            setBankDetails({
                bankAccountNo: currentCase.bankAccountNo || '',
                bankIfscCode: currentCase.bankIfscCode || '',
                bankName: currentCase.bankName || '',
                bankBranch: currentCase.bankBranch || '',
                bankType: currentCase.bankType || 'savings',
            })
        }
    }, [currentCase])

    const handleSaveBankDetails = async () => {
        setIsUpdating(true)
        try {
            await workflowService.updateBankDetails(id, bankDetails)
            alert('Bank details saved successfully')
            dispatch(fetchCaseById(id))
        } catch (error) {
            alert('Failed to save bank details')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleUpload = async (file, type) => {
        try {
            await documentService.uploadDocument(id, file, type)
            alert('Document uploaded successfully')
            dispatch(fetchCaseById(id))
        } catch (error) {
            alert('Upload failed: ' + (error.response?.data?.message || error.message))
        }
    }

    const handleTriggerDigitalJourney = async (type) => {
        setIsUpdating(true)
        try {
            const payload = type === 'esign' ? { eSignStatus: 'completed' } : { eNachStatus: 'completed' }
            await workflowService.updateBankDetails(id, payload)
            alert(`${type.toUpperCase()} triggered and simulated successfully`)
            dispatch(fetchCaseById(id))
        } catch (error) {
            alert('Action failed')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleSubmitToOps = async () => {
        if (!remarks.trim()) {
            alert('Please add submission remarks')
            return
        }

        setIsSubmitting(true)
        try {
            await workflowService.submitToOperations(id, remarks)
            alert('Case submitted to Operations Team Successfully')
            navigate('/rm/dashboard')
        } catch (error) {
            alert('Submission failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <LoadingSpinner />
    if (!currentCase) return <div>Case not found</div>

    const formattedApprovals = (currentCase.statusHistory || []).map(action => ({
        approverName: action.changedByUser?.name || 'Workflow System',
        approverRole: action.changedByUser?.defaultRole?.replace(/_/g, ' ').toUpperCase() || 'System',
        status: action.status,
        approvedAt: action.createdAt,
        comments: action.remarks,
        sanctionAmount: action.sanctionAmount,
        tenure: action.tenure,
        interestRate: action.interestRate,
        penalCharges: action.penalCharges,
        processingFees: action.processingFees,
    }))

    const isReadOnly = ['ops_l1_review', 'ops_l1_approved', 'ops_l2_verified', 'ops_head_approved', 'completed', 'disbursed'].includes(currentCase.status);

    const latestSanction = currentCase.creditSanctions?.[0]

    return (
        <div className="space-y-6 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate('/rm/dashboard')}
                        className="text-primary-600 hover:text-primary-700 mb-4"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Post-Sanction Review</h1>
                    <p className="text-gray-500">Case approved by MD. Please complete digital journey and bank details.</p>
                </div>
                <div className="flex space-x-2">
                    <span className="badge bg-green-100 text-green-800 p-2">MD APPROVED</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Information */}
                    <CustomerFullDetails customer={currentCase} />

                    {/* Sanction Info (Read Only) */}
                    <div className="card border-l-4 border-indigo-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Final Sanction Terms</h2>
                            <FiLock className="text-gray-400" title="Locked - Cannot be modified by RM" />
                        </div>
                        {latestSanction ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-xs text-indigo-600 uppercase font-bold">Sanction Amount</p>
                                    <p className="text-lg font-bold">₹{latestSanction.sanctionAmount}</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-xs text-indigo-600 uppercase font-bold">Tenure</p>
                                    <p className="text-lg font-bold">{latestSanction.tenure} Months</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-xs text-indigo-600 uppercase font-bold">Interest Rate</p>
                                    <p className="text-lg font-bold">{latestSanction.interestRate}%</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-xs text-indigo-600 uppercase font-bold">Penal Charges</p>
                                    <p className="text-lg font-bold">{latestSanction.penalCharges}%</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <p className="text-xs text-indigo-600 uppercase font-bold">Processing Fees</p>
                                    <p className="text-lg font-bold">{latestSanction.processingFees}%</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-red-500 font-medium">Warning: No sanction record found!</p>
                        )}
                    </div>

                    {/* Bank Details Form */}
                    <div className="card">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Bank Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                <input
                                    type="text"
                                    value={bankDetails.bankAccountNo}
                                    onChange={(e) => setBankDetails({ ...bankDetails, bankAccountNo: e.target.value })}
                                    className="input-field"
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    value={bankDetails.bankIfscCode}
                                    onChange={(e) => setBankDetails({ ...bankDetails, bankIfscCode: e.target.value })}
                                    className="input-field"
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                <input
                                    type="text"
                                    value={bankDetails.bankName}
                                    onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                                    className="input-field"
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                                <input
                                    type="text"
                                    value={bankDetails.bankBranch}
                                    onChange={(e) => setBankDetails({ ...bankDetails, bankBranch: e.target.value })}
                                    className="input-field"
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                                <select
                                    value={bankDetails.bankType}
                                    onChange={(e) => setBankDetails({ ...bankDetails, bankType: e.target.value })}
                                    className="input-field"
                                    disabled={isReadOnly}
                                >
                                    <option value="savings">Savings</option>
                                    <option value="current">Current</option>
                                    <option value="overdraft">Overdraft</option>
                                </select>
                            </div>
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={handleSaveBankDetails}
                                disabled={isUpdating}
                                className="mt-4 btn-secondary text-sm flex items-center space-x-1"
                            >
                                {isUpdating ? <LoadingSpinner size="sm" /> : <FiCheck className="h-4 w-4" />}
                                <span>Save Bank Details</span>
                            </button>
                        )}
                    </div>

                    {/* Digital Journey Actions */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="card">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">E-NACH Mandate</h3>
                                <span className={`text-xs px-2 py-1 rounded-full ${currentCase.eNachStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {currentCase.eNachStatus?.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Setup automated repayment from customer's bank account.</p>
                            <button
                                disabled={isReadOnly || currentCase.eNachStatus === 'completed' || isUpdating}
                                onClick={() => handleTriggerDigitalJourney('enach')}
                                className="w-full btn-primary py-2 text-sm disabled:opacity-50"
                            >
                                {isUpdating ? <LoadingSpinner size="sm" /> : 'Trigger e-NACH'}
                            </button>
                        </div>
                        <div className="card">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">E-Sign Agreement</h3>
                                <span className={`text-xs px-2 py-1 rounded-full ${currentCase.eSignStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {currentCase.eSignStatus?.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Digitally sign the loan agreement with the customer.</p>
                            <button
                                disabled={isReadOnly || currentCase.eSignStatus === 'completed' || isUpdating}
                                onClick={() => handleTriggerDigitalJourney('esign')}
                                className="w-full btn-primary py-2 text-sm disabled:opacity-50"
                            >
                                {isUpdating ? <LoadingSpinner size="sm" /> : 'Trigger e-Sign'}
                            </button>
                        </div>
                    </div>

                    {/* Bank Related Documents Folder */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Bank Related Documents</h2>
                            {!isReadOnly && (
                                <DocumentUploader
                                    customerId={id}
                                    onUpload={handleUpload}
                                    documentTypes={[
                                        { value: 'cheque', label: 'Cheque' },
                                        { value: 'live_photo', label: 'Live Photo' },
                                        { value: 'shop_photo', label: 'Shop Photo' },
                                        { value: 'bank_statement', label: 'Bank Statement' },
                                        { value: 'other', label: 'Other Documents' },
                                    ]}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            {currentCase.documents?.filter(d => (d.documentType === 'bank_statement' || d.documentType === 'other')).map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <FiFile className="text-gray-400" />
                                        <span className="text-sm">{doc.fileName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                                        <button
                                            onClick={() => {
                                                const fileUrl = doc.filePath.startsWith('http')
                                                    ? doc.filePath
                                                    : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000'}/${doc.filePath.replace(/\\/g, '/')}`
                                                window.open(fileUrl, '_blank')
                                            }}
                                            className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                                            title="Preview"
                                        >
                                            <FiEye className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="card">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Submission to Operations</h2>
                        {!isReadOnly ? (
                            <>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full input-field mb-4"
                                    rows={4}
                                    placeholder="Final submission remarks..."
                                />
                                <button
                                    disabled={isSubmitting || currentCase.eNachStatus !== 'completed' || currentCase.eSignStatus !== 'completed'}
                                    onClick={handleSubmitToOps}
                                    className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
                                >
                                    <FiSend />
                                    <span>Final Submit to Ops</span>
                                </button>
                                {(currentCase.eNachStatus !== 'completed' || currentCase.eSignStatus !== 'completed') && (
                                    <p className="text-xs text-red-500 mt-2 text-center">Complete digital journey before submission</p>
                                )}
                            </>
                        ) : (
                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Read Only Mode</p>
                                <p className="text-xs text-gray-400 mt-1">Case has been submitted to Operations.</p>
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <ApprovalTimeline approvals={formattedApprovals} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RMCaseDetail
