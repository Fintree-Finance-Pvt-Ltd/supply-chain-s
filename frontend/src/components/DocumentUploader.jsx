import { useState } from 'react'
import { FiUpload, FiX, FiFile, FiEye } from 'react-icons/fi'

const DocumentUploader = ({ 
  documents = [], 
  onUpload, 
  onRemove, 
  documentTypes = [],
  maxFiles = 10 
}) => {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [selectedType, setSelectedType] = useState('')

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles(files)
  }

  const handleUpload = () => {
    if (selectedFiles.length === 0 || !selectedType) {
      alert('Please select files and document type')
      return
    }
    
    selectedFiles.forEach((file) => {
      onUpload(file, selectedType)
    })
    
    setSelectedFiles([])
    setSelectedType('')
    // Reset file input
    const fileInput = document.getElementById('file-input')
    if (fileInput) fileInput.value = ''
  }

  const handleRemove = (docId) => {
    if (window.confirm('Are you sure you want to remove this document?')) {
      onRemove(docId)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input-field"
          >
            <option value="">Select document type</option>
            {documentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Files
          </label>
          <div className="flex items-center space-x-2">
            <label className="flex-1 cursor-pointer">
              <input
                id="file-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <div className="input-field flex items-center justify-center space-x-2 border-dashed">
                <FiUpload className="h-5 w-5" />
                <span className="text-sm">Choose files</span>
              </div>
            </label>
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || !selectedType}
              className="btn-primary"
            >
              Upload
            </button>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            {selectedFiles.length} file(s) selected. Click Upload to add them.
          </p>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Documents</h4>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FiFile className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                    <p className="text-xs text-gray-500">{doc.documentType}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {doc.filePath && (
                    <button
                      onClick={() => {
                        const fileUrl = doc.filePath.startsWith('http') 
                          ? doc.filePath 
                          : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000'}${doc.filePath.startsWith('/') ? '' : '/'}${doc.filePath}`
                        window.open(fileUrl, '_blank')
                      }}
                      className="p-2 text-gray-600 hover:text-primary-600"
                      title="View"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => handleRemove(doc.id)}
                      className="p-2 text-red-600 hover:text-red-700"
                      title="Remove"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentUploader

