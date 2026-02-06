import { useState } from 'react'
import { FiUpload, FiX, FiFile, FiCheckCircle, FiEye, FiCalendar, FiMessageSquare } from 'react-icons/fi'
import { documentService } from '../services/documentService'
import { API_BASE_URL } from '../constants/api'

const DocumentChecklistUploader = ({
    checklist = [],
    uploadedDocuments = [],
    customerId,
    onDocumentUploaded,
    onDocumentRemoved
}) => {
    const [uploadingKey, setUploadingKey] = useState(null)
    const [docMeta, setDocMeta] = useState({}) // Stores meta for each checklist item key

    // Check if a document of a specific type has been uploaded
    const isDocumentUploaded = (documentType) => {
        return uploadedDocuments.some(doc => doc.documentType === documentType)
    }

    // Get uploaded documents for a specific type
    const getUploadedDocs = (documentType) => {
        return uploadedDocuments.filter(doc => doc.documentType === documentType)
    }

    const handleMetaChange = (key, field, value) => {
        setDocMeta(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }))
    }

    const handleDocumentUpload = async (checklistItem, file) => {
        if (!customerId) {
            alert('Please save customer details first')
            return
        }

        const meta = docMeta[checklistItem.key] || {}

        setUploadingKey(checklistItem.key)
        try {
            const result = await documentService.uploadDocument(
                customerId,
                file,
                checklistItem.documentType,
                'applicant',
                0,
                null,
                meta
            )

            if (result.data) {
                if (onDocumentUploaded) {
                    onDocumentUploaded(result.data)
                }
                // Clear meta for this item after successful upload
                handleMetaChange(checklistItem.key, 'issueDate', '')
                handleMetaChange(checklistItem.key, 'expiryDate', '')
                handleMetaChange(checklistItem.key, 'remarks', '')
                alert('Document uploaded successfully')
            }
        } catch (error) {
            alert('Failed to upload document: ' + error.message)
        } finally {
            setUploadingKey(null)
        }
    }

    const handleFileSelect = (checklistItem, e) => {
        const file = e.target.files[0]
        if (file) {
            handleDocumentUpload(checklistItem, file)
        }
        // Reset input
        e.target.value = ''
    }

    const handleRemoveDocument = async (doc) => {
        if (!window.confirm('Are you sure you want to remove this document?')) {
            return
        }

        try {
            await documentService.deleteDocument(doc.id)
            if (onDocumentRemoved) {
                onDocumentRemoved(doc.id)
            }
        } catch (error) {
            alert('Failed to remove document: ' + error.message)
        }
    }

    const handlePreview = (doc) => {
        // Construct full path
        const baseUrl = API_BASE_URL.replace('/api', '')
        const fileUrl = doc.filePath.startsWith('http')
            ? doc.filePath
            : `${baseUrl}/${doc.filePath.replace(/\\/g, '/')}`
        window.open(fileUrl, '_blank')
    }

    if (checklist.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>Please select a company type to see the document checklist</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Document Checklist</h3>
                <p className="text-sm text-gray-600">
                    <span className="text-red-500">*</span> Mandatory documents
                </p>
            </div>

            <div className="space-y-3">
                {checklist.map((item) => {
                    const uploaded = isDocumentUploaded(item.documentType)
                    const uploadedDocs = getUploadedDocs(item.documentType)
                    const isUploading = uploadingKey === item.key
                    const meta = docMeta[item.key] || { issueDate: '', expiryDate: '', remarks: '' }

                    return (
                        <div
                            key={item.key}
                            className={`border rounded-lg p-4 ${uploaded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                                }`}
                        >
                            <div className="flex flex-col space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            {uploaded && (
                                                <FiCheckCircle className="h-5 w-5 text-green-600" />
                                            )}
                                            <h4 className="font-medium text-gray-900">
                                                {item.label}
                                                {item.mandatory && <span className="text-red-500 ml-1">*</span>}
                                            </h4>
                                        </div>

                                        {/* Show uploaded files */}
                                        {uploadedDocs.length > 0 && (
                                            <div className="space-y-2 mt-3">
                                                {uploadedDocs.map((doc) => (
                                                    <div
                                                        key={doc.id}
                                                        className="flex flex-col bg-white p-3 rounded border border-gray-200"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <FiFile className="h-4 w-4 text-gray-500" />
                                                                <span className="text-sm font-medium text-gray-700">{doc.fileName}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => handlePreview(doc)}
                                                                    className="p-1 text-primary-600 hover:text-primary-700"
                                                                    title="Preview"
                                                                >
                                                                    <FiEye className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveDocument(doc)}
                                                                    className="p-1 text-red-600 hover:text-red-700"
                                                                    title="Remove"
                                                                >
                                                                    <FiX className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {(doc.issueDate || doc.expiryDate || doc.remarks) && (
                                                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 border-t pt-2">
                                                                {doc.issueDate && (
                                                                    <div><span className="font-semibold">Issue:</span> {new Date(doc.issueDate).toLocaleDateString()}</div>
                                                                )}
                                                                {doc.expiryDate && (
                                                                    <div><span className="font-semibold">Expiry:</span> {new Date(doc.expiryDate).toLocaleDateString()}</div>
                                                                )}
                                                                {doc.remarks && (
                                                                    <div className="col-span-2"><span className="font-semibold">Remarks:</span> {doc.remarks}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload button */}
                                    <div className="ml-4">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => handleFileSelect(item, e)}
                                                className="hidden"
                                                disabled={isUploading}
                                            />
                                            <div
                                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${isUploading
                                                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                                                    : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                                                    }`}
                                            >
                                                <FiUpload className="h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    {isUploading ? 'Uploading...' : uploaded ? 'Add More' : 'Upload'}
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Meta inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center space-x-1.5 text-gray-600">
                                            <FiCalendar className="h-3.5 w-3.5" />
                                            <label className="text-xs font-bold uppercase tracking-wider">Issue Date</label>
                                        </div>
                                        <input
                                            type="date"
                                            value={meta.issueDate || ''}
                                            onChange={(e) => handleMetaChange(item.key, 'issueDate', e.target.value)}
                                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white transition-all hover:border-gray-300"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center space-x-1.5 text-gray-600">
                                            <FiCalendar className="h-3.5 w-3.5" />
                                            <label className="text-xs font-bold uppercase tracking-wider">Expiry Date</label>
                                        </div>
                                        <input
                                            type="date"
                                            value={meta.expiryDate || ''}
                                            onChange={(e) => handleMetaChange(item.key, 'expiryDate', e.target.value)}
                                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white transition-all hover:border-gray-300"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center space-x-1.5 text-gray-600">
                                            <FiMessageSquare className="h-3.5 w-3.5" />
                                            <label className="text-xs font-bold uppercase tracking-wider">Remarks</label>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Add notes about this document..."
                                            value={meta.remarks || ''}
                                            onChange={(e) => handleMetaChange(item.key, 'remarks', e.target.value)}
                                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white transition-all hover:border-gray-300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Validation Summary */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Upload Summary</h4>
                <div className="text-sm text-blue-800">
                    <p>
                        Total Documents: {checklist.length} |
                        Mandatory: {checklist.filter(item => item.mandatory).length} |
                        Uploaded: {uploadedDocuments.length}
                    </p>
                    {checklist.filter(item => item.mandatory && !isDocumentUploaded(item.documentType)).length > 0 && (
                        <p className="text-red-600 font-medium mt-2">
                            ⚠️ {checklist.filter(item => item.mandatory && !isDocumentUploaded(item.documentType)).length} mandatory document(s) pending
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DocumentChecklistUploader
