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
import { FiFileText, FiCheck, FiSend, FiFile, FiLock, FiEye, FiCamera, FiRefreshCw } from 'react-icons/fi'
import { Toaster, toast } from 'react-hot-toast'

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

    const [sanctionData, setSanctionData] = useState({
        sanctionAmount: '',
        tenure: '',
        interestRate: '',
        penalCharges: '',
        processingFees: '',
        conditions: '',
    })

    const [remarks, setRemarks] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    // Camera/OCR State
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [cameraStream, setCameraStream] = useState(null)
    const [capturedImage, setCapturedImage] = useState(null)
    const [cameraType, setCameraType] = useState('environment') // 'user' or 'environment'

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
            if (currentCase.creditSanctions?.[0]) {
                const s = currentCase.creditSanctions[0]
                setSanctionData({
                    sanctionAmount: s.sanctionAmount || '',
                    tenure: s.tenure || '',
                    interestRate: s.interestRate || '',
                    penalCharges: s.penalCharges || '',
                    processingFees: s.processingFees || '',
                    conditions: s.conditions || '',
                })
            }
        }
    }, [currentCase])

    const handleSaveBankDetails = async () => {
        setIsUpdating(true)
        try {
            await workflowService.updateBankDetails(id, { ...bankDetails, sanctionData })
            alert('Details saved successfully')
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

    const handleSubmitToMD = async () => {
        setIsSubmitting(true)
        try {
            await workflowService.submitRMToMD(id, "Final terms confirmed by RM", sanctionData)
            toast.success('Case submitted to MD successfully')
            dispatch(fetchCaseById(id))
            navigate('/rm/dashboard')
        } catch (error) {
            toast.error('Submission failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmitToOps = async () => {
        if (!remarks.trim()) {
            toast.error('Please add submission remarks')
            return
        }

        setIsSubmitting(true)
        try {
            await workflowService.submitToOperations(id, remarks)
            toast.success('Case submitted to Operations Team Successfully')
            navigate('/rm/dashboard')
        } catch (error) {
            toast.error('Submission failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Camera Logic
    const toggleCamera = async () => {
        if (isCameraOpen) {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            setIsCameraOpen(false);
            setCameraStream(null);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: cameraType }
                });
                setCameraStream(stream);
                setIsCameraOpen(true);
            } catch (err) {
                toast.error("Camera access denied or not available");
            }
        }
    };

    const switchCamera = async () => {
        const newType = cameraType === 'user' ? 'environment' : 'user';
        setCameraType(newType);
        if (isCameraOpen) {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: newType }
                });
                setCameraStream(stream);
            } catch (err) {
                toast.error("Failed to switch camera");
            }
        }
    };

    const capturePhoto = () => {
        const video = document.getElementById('camera-preview');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);

        // Stop camera
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        setIsCameraOpen(false);
        setCameraStream(null);

        // Simulate OCR
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: 'Processing Cheque OCR...',
                success: 'OCR Completed Successfully!',
                error: 'OCR Failed',
            }
        ).then(() => {
            // Mock data extraction
            setBankDetails(prev => ({
                ...prev,
                bankAccountNo: '9182736455',
                bankIfscCode: 'HDFC0001234',
                bankName: 'HDFC BANK LTD',
                bankBranch: 'MUMBAI BRANCH'
            }));
        });
    };

    const handleUploadCaptured = async () => {
        if (!capturedImage) return;
        // Convert dataUrl to File
        const blob = await (await fetch(capturedImage)).blob();
        const file = new File([blob], "cheque_capture.jpg", { type: "image/jpeg" });
        await handleUpload(file, 'cheque');
        setCapturedImage(null);
    };

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

    const isReadOnly = ['md_terms_submitted', 'ops_l1_review', 'ops_l1_approved', 'ops_l2_verified', 'ops_head_approved', 'completed', 'disbursed'].includes(currentCase.status);

    const isStage1 = currentCase.status === 'md_pending_terms';
    const isStage2 = currentCase.status === 'md_approved';

    const statusLabel = isStage1 ? "MD APPROVED - PENDING FINAL TERMS" :
        currentCase.status === 'md_terms_submitted' ? "PENDING MD FINAL APPROVAL" :
            currentCase.status === 'md_approved' ? "MD FINAL APPROVED - PENDING DOCUMENTS" :
                currentCase.status.replace(/_/g, ' ').toUpperCase();

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
                    <p className="text-gray-500">
                        {isStage1 ? "Prepare final sanction details based on negotiation." : "Complete digital journey and bank details."}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <span className={`badge ${isStage2 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} p-2`}>
                        {statusLabel}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Information */}
                    <CustomerFullDetails customer={currentCase} />

                    {/* Sanction Info (Editable by RM) */}
                    <div className="card border-l-4 border-indigo-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Final Sanction Terms</h2>
                            <FiSend className="text-primary-500" title="RM can now edit sanction details if required" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">Sanction Amount</label>
                                <input
                                    type="number"
                                    value={sanctionData.sanctionAmount}
                                    onChange={(e) => setSanctionData({ ...sanctionData, sanctionAmount: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0"
                                    readOnly={isReadOnly || isStage2}
                                />
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">Tenure (Months)</label>
                                <input
                                    type="number"
                                    value={sanctionData.tenure}
                                    onChange={(e) => setSanctionData({ ...sanctionData, tenure: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0"
                                    readOnly={isReadOnly || isStage2}
                                />
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">Interest Rate (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sanctionData.interestRate}
                                    onChange={(e) => setSanctionData({ ...sanctionData, interestRate: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0"
                                    readOnly={isReadOnly || isStage2}
                                />
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">Penal Charges (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sanctionData.penalCharges}
                                    onChange={(e) => setSanctionData({ ...sanctionData, penalCharges: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0"
                                    readOnly={isReadOnly || isStage2}
                                />
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">Processing Fees (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={sanctionData.processingFees}
                                    onChange={(e) => setSanctionData({ ...sanctionData, processingFees: e.target.value })}
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0"
                                    readOnly={isReadOnly || isStage2}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stage 1 Actions */}
                    {isStage1 && (
                        <div className="card bg-primary-50 border-primary-200">
                            <h2 className="text-xl font-bold text-primary-900 mb-2">Next Step: Submit to MD</h2>
                            <p className="text-sm text-primary-700 mb-4">Please verify the final sanction terms above. Once submitted, the Managing Director will review and provide final approval.</p>
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleSaveBankDetails}
                                    disabled={isUpdating}
                                    className="btn-secondary flex-1 flex items-center justify-center space-x-2"
                                >
                                    <FiCheck />
                                    <span>Save Progress</span>
                                </button>
                                <button
                                    onClick={handleSubmitToMD}
                                    disabled={isSubmitting}
                                    className="btn-primary flex-1 flex items-center justify-center space-x-2 py-3"
                                >
                                    <FiSend />
                                    <span>Submit to MD</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bank Details Form */}
                    {isStage2 && (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Bank Details & Cheque OCR</h2>

                            {/* Cheque OCR Section */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-gray-800">Cheque Capture</h4>
                                        <p className="text-xs text-gray-500">Capture cheque photo to auto-fill bank details</p>
                                    </div>
                                    {!isReadOnly && !capturedImage && (
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={toggleCamera}
                                                className="px-3 py-1 bg-primary-600 text-white text-xs rounded-full flex items-center space-x-1"
                                            >
                                                <FiCamera />
                                                <span>{isCameraOpen ? 'Stop' : 'Start Camera'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isCameraOpen && (
                                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                        <video
                                            id="camera-preview"
                                            autoPlay
                                            playsInline
                                            ref={el => { if (el) el.srcObject = cameraStream; }}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                                            <button
                                                onClick={switchCamera}
                                                className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"
                                            >
                                                <FiRefreshCw />
                                            </button>
                                            <button
                                                onClick={capturePhoto}
                                                className="p-4 bg-white rounded-full text-primary-600 shadow-lg hover:scale-110 transition-transform"
                                            >
                                                <div className="w-8 h-8 rounded-full border-4 border-primary-600" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {capturedImage && (
                                    <div className="space-y-4">
                                        <div className="relative rounded-lg overflow-hidden border">
                                            <img src={capturedImage} alt="Captured" className="w-full" />
                                            <button
                                                onClick={() => setCapturedImage(null)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow"
                                            >
                                                <FiRefreshCw />
                                            </button>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={handleUploadCaptured}
                                                className="btn-primary flex-1 py-2 text-xs"
                                            >
                                                Upload Cheque Image
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

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
                    )}

                    {/* Digital Journey Actions */}
                    {isStage2 && (
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
                    )}

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
                            {currentCase.documents?.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <FiFile className="text-gray-400" />
                                        <div className="flex flex-col">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium">{doc.fileName}</span>
                                                {doc.applicantType === 'co-applicant' ? (
                                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
                                                ) : (
                                                    <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold">{doc.documentType}</span>
                                        </div>
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
