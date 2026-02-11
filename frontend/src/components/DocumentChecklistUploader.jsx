import { useState, useEffect } from 'react'
import { FiUpload, FiX, FiFile, FiCheckCircle, FiEye, FiMessageSquare } from 'react-icons/fi'
import { documentService } from '../services/documentService'

const DocumentChecklistUploader = ({
    checklist = [],
    uploadedDocuments = [],
    customerId,
    onDocumentUploaded,
    onDocumentRemoved,
    readOnly = false
}) => {
    const [uploading, setUploading] = useState({})
    const [meta, setMeta] = useState({})

    // Initialize/Sync meta with uploaded documents
    useEffect(() => {
        const newMeta = {}
        let hasUpdates = false

        uploadedDocuments.forEach(doc => {
            const item = checklist.find(i => i.documentType === doc.documentType)
            if (item) {
                const currentRemark = meta[item.key]?.rmRemarks
                const docRemark = doc.rmRemarks || doc.remarks || ''

                // Only update if we don't have a value (initial load) or if it differs (sync)
                // But be careful not to overwrite user input while typing. 
                // So strictly speaking, we might want to just set this on mount or when doc list changes significantly.
                // For now, let's trusting that uploadedDocuments is the source of truth for *existing* items.
                if (currentRemark === undefined) {
                    newMeta[item.key] = { rmRemarks: docRemark }
                    hasUpdates = true
                }
            }
        })

        if (hasUpdates) {
            setMeta(prev => ({ ...prev, ...newMeta }))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadedDocuments, checklist])

    const handleFileSelect = async (item, e) => {
        if (readOnly) return
        const file = e.target.files[0]
        if (!file) return

        setUploading(prev => ({ ...prev, [item.key]: true }))
        try {
            if (!customerId) {
                alert('Please save the "Basic & KYC" details first to generate a Case ID.')
                return
            }

            const itemMeta = meta[item.key] || {}

            // Pass meta to upload
            const response = await documentService.uploadDocument(
                customerId,
                file,
                item.documentType,
                'applicant', // Default
                0, // Default
                null, // Default
                itemMeta
            )

            if (onDocumentUploaded) {
                onDocumentUploaded(response.data)
            }
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Failed to upload document: ' + (error.response?.data?.message || error.message))
        } finally {
            setUploading(prev => ({ ...prev, [item.key]: false }))
            if (e.target) e.target.value = ''
        }
    }

    const handleRemoveDocument = async (doc) => {
        if (readOnly) return
        if (!window.confirm('Are you sure you want to remove this document?')) return

        try {
            await documentService.deleteDocument(doc.id)
            if (onDocumentRemoved) {
                onDocumentRemoved(doc.id)
            }
        } catch (error) {
            console.error('Remove failed:', error)
            alert('Failed to remove document')
        }
    }

    const [editingMeta, setEditingMeta] = useState({})

    const handleLocalUpdate = (docId, field, value) => {
        setEditingMeta(prev => ({
            ...prev,
            [docId]: {
                ...(prev[docId] || {}),
                [field]: value
            }
        }))
    }

    const handleSaveMeta = async (docId, field, value) => {
        try {
            const updates = { [field]: value }
            const response = await documentService.updateDocumentMetadata(docId, updates)
            if (response.success && onDocumentUploaded) {
                // Clear local edit for this specific field if successful
                // actually, keeping it until refresh is fine if it matches.
                onDocumentUploaded(response.data)
            }
        } catch (error) {
            console.error('Failed to save metadata:', error)
        }
    }

    const handlePreview = (doc) => {
        const fileUrl = doc.filePath?.startsWith('http')
            ? doc.filePath
            : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000'}/${doc.filePath?.replace(/\\/g, '/')}`
        window.open(fileUrl, '_blank')
    }

    const isDocumentUploaded = (type) => {
        return uploadedDocuments.some(d => d.documentType === type)
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Required Documents</h3>
                <span className="text-sm text-gray-500">
                    {uploadedDocuments.length} / {checklist.length} Uploaded
                </span>
            </div>

            <div className="space-y-3">
                {checklist.map((item) => {
                    const uploadedDocs = uploadedDocuments.filter(d => d.documentType === item.documentType)
                    const isUploaded = uploadedDocs.length > 0
                    const isUploading = uploading[item.key]
                    const itemMeta = meta[item.key] || {}

                    return (
                        <div key={item.key} className={`p-4 rounded-xl border transition-all ${isUploaded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                            <div className="flex flex-col space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h4 className="text-sm font-semibold text-gray-900">{item.label}</h4>
                                            {item.mandatory && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">REQUIRED</span>}
                                            {isUploaded && <FiCheckCircle className="text-green-500 h-4 w-4" />}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>

                                        {uploadedDocs.length > 0 && (
                                            <div className="space-y-4 mt-3">
                                                {uploadedDocs.map((doc) => {
                                                    const currentEdits = editingMeta[doc.id] || {}

                                                    return (
                                                        <div key={doc.id} className="p-3 bg-white rounded-lg border border-green-100 shadow-sm space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-2">
                                                                    <FiFile className="h-4 w-4 text-gray-500" />
                                                                    <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{doc.fileName}</span>
                                                                    {doc.applicantType === 'co-applicant' ? (
                                                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
                                                                    ) : (
                                                                        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <button
                                                                        onClick={() => handlePreview(doc)}
                                                                        className="p-1 text-primary-600 hover:text-primary-700"
                                                                        title="Preview"
                                                                    >
                                                                        <FiEye className="h-4 w-4" />
                                                                    </button>
                                                                    {!readOnly && (
                                                                        <button
                                                                            onClick={() => handleRemoveDocument(doc)}
                                                                            className="p-1 text-red-600 hover:text-red-700"
                                                                            title="Remove"
                                                                        >
                                                                            <FiX className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Metadata Fields for Each Document */}
                                                            {!readOnly && (
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-50">
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Issue Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={currentEdits.issueDate !== undefined ? currentEdits.issueDate : (doc.issueDate?.split('T')[0] || '')}
                                                                            onChange={(e) => handleLocalUpdate(doc.id, 'issueDate', e.target.value)}
                                                                            onBlur={(e) => handleSaveMeta(doc.id, 'issueDate', e.target.value)}
                                                                            className="w-full text-[11px] border-gray-200 rounded p-1"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Expiry Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={currentEdits.expiryDate !== undefined ? currentEdits.expiryDate : (doc.expiryDate?.split('T')[0] || '')}
                                                                            onChange={(e) => handleLocalUpdate(doc.id, 'expiryDate', e.target.value)}
                                                                            onBlur={(e) => handleSaveMeta(doc.id, 'expiryDate', e.target.value)}
                                                                            className="w-full text-[11px] border-gray-200 rounded p-1"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">RM Remarks</label>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Add remarks..."
                                                                            value={currentEdits.rmRemarks !== undefined ? currentEdits.rmRemarks : (doc.rmRemarks || '')}
                                                                            onChange={(e) => handleLocalUpdate(doc.id, 'rmRemarks', e.target.value)}
                                                                            onBlur={(e) => handleSaveMeta(doc.id, 'rmRemarks', e.target.value)}
                                                                            className="w-full text-[11px] border-gray-200 rounded p-1"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>


                                    {!readOnly && (
                                        <div className="ml-4">
                                            <label className={`cursor-pointer flex items-center space-x-2 px-3 py-2 rounded-lg border border-dashed transition-colors ${isUploading ? 'bg-gray-100 border-gray-300 cursor-wait' : 'hover:bg-blue-50 hover:border-blue-300 border-gray-300'}`}>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => handleFileSelect(item, e)}
                                                    className="hidden"
                                                    disabled={isUploading}
                                                />
                                                {isUploading ? (
                                                    <span className="text-xs font-medium text-gray-500">Uploading...</span>
                                                ) : (
                                                    <>
                                                        <FiUpload className="h-4 w-4 text-gray-500" />
                                                        <span className="text-xs font-medium text-gray-700">{isUploaded ? 'Add Another' : 'Upload'}</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

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
