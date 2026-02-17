// import { useState } from 'react'
// import { FiUpload, FiX, FiFile, FiEye } from 'react-icons/fi'

// const DocumentUploader = ({
//   documents = [],
//   onUpload,
//   onRemove,
//   documentTypes = [],
//   maxFiles = 10
// }) => {
//   const [selectedFiles, setSelectedFiles] = useState([])
//   const [selectedType, setSelectedType] = useState('')

//   const handleFileSelect = (e) => {
//     const files = Array.from(e.target.files)
//     setSelectedFiles(files)
//   }

//   const handleUpload = () => {
//     if (selectedFiles.length === 0 || !selectedType) {
//       alert('Please select files and document type')
//       return
//     }

//     selectedFiles.forEach((file) => {
//       onUpload(file, selectedType)
//     })

//     setSelectedFiles([])
//     setSelectedType('')
//     // Reset file input
//     const fileInput = document.getElementById('file-input')
//     if (fileInput) fileInput.value = ''
//   }

//   const handleRemove = (docId) => {
//     if (window.confirm('Are you sure you want to remove this document?')) {
//       onRemove(docId)
//     }
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex items-end space-x-4">
//         <div className="flex-1">
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Document Type
//           </label>
//           <select
//             value={selectedType}
//             onChange={(e) => setSelectedType(e.target.value)}
//             className="input-field"
//           >
//             <option value="">Select document type</option>
//             {documentTypes.map((type) => (
//               <option key={type.value} value={type.value}>
//                 {type.label}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div className="flex-1">
//           <label className="block text-sm font-medium text-gray-700 mb-2">
//             Upload Files
//           </label>
//           <div className="flex items-center space-x-2">
//             <label className="flex-1 cursor-pointer">
//               <input
//                 id="file-input"
//                 type="file"
//                 multiple
//                 onChange={handleFileSelect}
//                 className="hidden"
//                 accept=".pdf,.jpg,.jpeg,.png"
//               />
//               <div className="input-field flex items-center justify-center space-x-2 border-dashed">
//                 <FiUpload className="h-5 w-5" />
//                 <span className="text-sm">Choose files</span>
//               </div>
//             </label>
//             <button
//               onClick={handleUpload}
//               disabled={selectedFiles.length === 0 || !selectedType}
//               className="btn-primary"
//             >
//               Upload
//             </button>
//           </div>
//         </div>
//       </div>

//       {selectedFiles.length > 0 && (
//         <div className="bg-blue-50 p-3 rounded-lg">
//           <p className="text-sm text-blue-800">
//             {selectedFiles.length} file(s) selected. Click Upload to add them.
//           </p>
//         </div>
//       )}

//       {documents.length > 0 && (
//         <div className="space-y-2">
//           <h4 className="text-sm font-medium text-gray-700">Uploaded Documents</h4>
//           <div className="space-y-2">
//             {documents.map((doc) => (
//               <div
//                 key={doc.id}
//                 className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
//               >
//                 <div className="flex items-center space-x-3">
//                   <FiFile className="h-5 w-5 text-gray-500" />
//                   <div className="flex flex-col">
//                     <div className="flex items-center space-x-2">
//                       <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
//                       {doc.applicantType === 'co-applicant' ? (
//                         <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
//                       ) : (
//                         <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
//                       )}
//                     </div>
//                     <p className="text-xs text-gray-500 uppercase font-bold">{doc.documentType}</p>
//                   </div>
//                 </div>
//                 <div className="flex items-center space-x-2">
//                   {doc.filePath && (
//                     <button
//                       onClick={() => {
//                         const fileUrl = doc.filePath.startsWith('http')
//                           ? doc.filePath
//                           : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000'}/${doc.filePath.replace(/\\/g, '/')}`
//                         window.open(fileUrl, '_blank')
//                       }}
//                       className="p-2 text-gray-600 hover:text-primary-600"
//                       title="View"
//                     >
//                       <FiEye className="h-4 w-4" />
//                     </button>
//                   )}
//                   {onRemove && (
//                     <button
//                       onClick={() => handleRemove(doc.id)}
//                       className="p-2 text-red-600 hover:text-red-700"
//                       title="Remove"
//                     >
//                       <FiX className="h-4 w-4" />
//                     </button>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default DocumentUploader


import { useState, useRef } from 'react'
import { FiUpload, FiX, FiFile, FiEye } from 'react-icons/fi'

const MAX_FILE_MB = 5
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

const DocumentUploader = ({
  documents = [],
  onUpload,
  onRemove,
  documentTypes = [],
  maxFiles = 10,
  readOnly = false,
  onNotify
}) => {

  const fileInputRef = useRef(null)

  const [selectedFiles, setSelectedFiles] = useState([])
  const [selectedType, setSelectedType] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const notify = (type, message) => {
    if (onNotify) return onNotify(type, message)
    if (type === 'error') console.error(message)
    else console.log(message)
  }

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type))
      return 'Only PDF/JPG/PNG allowed'

    if (file.size / (1024 * 1024) > MAX_FILE_MB)
      return `Max file size ${MAX_FILE_MB}MB`

    return null
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)

    if (documents.length + files.length > maxFiles) {
      notify('error', `Maximum ${maxFiles} files allowed`)
      e.target.value = ''
      return
    }

    for (const file of files) {
      const error = validateFile(file)
      if (error) {
        notify('error', error)
        e.target.value = ''
        return
      }
    }

    setSelectedFiles(files)
  }

  const handleUpload = async () => {
    if (!selectedFiles.length || !selectedType) {
      notify('error', 'Select document type and files')
      return
    }

    setIsUploading(true)

    try {
      for (const file of selectedFiles) {
        await onUpload(file, selectedType)
      }

      notify('success', 'Files uploaded successfully')

      setSelectedFiles([])
      setSelectedType('')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      notify('error', error?.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async (docId) => {
    if (readOnly) return
    try {
      await onRemove(docId)
      notify('success', 'Document removed')
    } catch {
      notify('error', 'Failed to remove document')
    }
  }

  const buildPreviewUrl = (filePath) => {
    if (!filePath) return null
    if (filePath.startsWith('http')) return filePath

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '')
    return `${baseUrl}/${filePath.replace(/\\/g, '/')}`
  }

  return (
    <div className="space-y-4">

      {/* Upload Section */}
      {!readOnly && (
        <div className="flex items-end space-x-4">

          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Document Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input-field"
              disabled={isUploading}
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
            <label className="block text-sm font-medium mb-2">
              Upload Files
            </label>

            <div className="flex space-x-2">
              <label className="flex-1 cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <div className="input-field border-dashed flex justify-center items-center">
                  <FiUpload className="mr-2" />
                  Choose Files
                </div>
              </label>

              <button
                onClick={handleUpload}
                disabled={!selectedFiles.length || !selectedType || isUploading}
                className="btn-primary"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm text-blue-800">
            {selectedFiles.length} file(s) selected.
          </p>
        </div>
      )}

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">

          <h4 className="text-sm font-medium text-gray-700">
            Uploaded Documents
          </h4>

          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex justify-between items-center p-3 bg-gray-50 rounded"
            >

              <div className="flex items-center space-x-3">
                <FiFile />
                <div>
                  <p className="text-sm font-medium">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-gray-500 uppercase">
                    {doc.documentType}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">

                {doc.filePath && (
                  <button
                    onClick={() => {
                      const url = buildPreviewUrl(doc.filePath)
                      if (url) window.open(url, '_blank')
                    }}
                    className="text-gray-600 hover:text-primary-600"
                  >
                    <FiEye />
                  </button>
                )}

                {!readOnly && (
                  <button
                    onClick={() => handleRemove(doc.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <FiX />
                  </button>
                )}

              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default DocumentUploader
