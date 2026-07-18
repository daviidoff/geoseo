import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function generateHealthReportPdf(result: any, url: string): Promise<Blob> {
  // TODO: Implement PDF generation with jspdf
  console.log('Generating health PDF for:', url)
  return new Blob(['Health Report PDF Placeholder'], { type: 'application/pdf' })
}

export async function generateMentionsReportPdf(result: any, companyName: string): Promise<Blob> {
  console.log('Generating mentions PDF for:', companyName, 'with result:', result)
  
  if (!result || !result.query_results || !Array.isArray(result.query_results)) {
    console.error('Invalid result data for PDF generation:', result)
    throw new Error('No valid mentions data to export')
  }

  // Create PDF document
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Title
  doc.setFontSize(20)
  doc.setTextColor(79, 70, 229) // Indigo color
  doc.text('AEO Mentions Report', 20, 30)
  
  // Company and date
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(`Company: ${companyName}`, 20, 45)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55)
  
  // Summary section
  const visibility = result.visibility_percentage || 0
  const totalQueries = result.query_results?.length || 0
  const totalMentions = result.total_mentions || 0
  const band = result.visibility_band || 'Unknown'
  
  doc.setFontSize(16)
  doc.setTextColor(79, 70, 229)
  doc.text('Executive Summary', 20, 75)
  
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  
  const summaryData = [
    ['Overall Visibility', `${visibility.toFixed(1)}%`],
    ['Visibility Band', band],
    ['Total Queries Tested', totalQueries.toString()],
    ['Total Mentions Found', totalMentions.toString()],
    ['Avg Mentions per Query', totalQueries > 0 ? (totalMentions / totalQueries).toFixed(2) : '0.00']
  ]
  
  // Summary table
  autoTable(doc, {
    startY: 85,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 11 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    margin: { left: 20, right: 20 }
  })
  
  // Query Results section
  let currentY = (doc as any).lastAutoTable.finalY + 20
  
  // Check if we need a new page
  if (currentY > 250) {
    doc.addPage()
    currentY = 30
  }
  
  doc.setFontSize(16)
  doc.setTextColor(79, 70, 229)
  doc.text('Query Results Breakdown', 20, currentY)
  
  // Prepare query results data for table
  const queryTableData: string[][] = []
  
  result.query_results.forEach((queryResult: any) => {
    if (queryResult.results && Array.isArray(queryResult.results)) {
      queryResult.results.forEach((platformResult: any) => {
        queryTableData.push([
          queryResult.query?.substring(0, 40) + (queryResult.query?.length > 40 ? '...' : '') || '',
          queryResult.type || queryResult.dimension || '',
          platformResult.platform || '',
          (platformResult.mentions || 0).toString(),
          (platformResult.quality_score || 0).toFixed(1)
        ])
      })
    }
  })
  
  // Query results table
  autoTable(doc, {
    startY: currentY + 10,
    head: [['Query', 'Type', 'Platform', 'Mentions', 'Quality']],
    body: queryTableData,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 60 }, // Query column wider
      1: { cellWidth: 25 }, // Type
      2: { cellWidth: 25 }, // Platform
      3: { cellWidth: 20 }, // Mentions
      4: { cellWidth: 20 }  // Quality
    },
    margin: { left: 20, right: 20 }
  })
  
  // Platform breakdown section
  currentY = (doc as any).lastAutoTable.finalY + 20
  
  if (currentY > 250) {
    doc.addPage()
    currentY = 30
  }
  
  doc.setFontSize(16)
  doc.setTextColor(79, 70, 229)
  doc.text('Platform Performance', 20, currentY)
  
  // Calculate platform stats
  const platformStats: Record<string, {mentions: number, queries: number, totalQuality: number}> = {}
  
  result.query_results.forEach((queryResult: any) => {
    if (queryResult.results && Array.isArray(queryResult.results)) {
      queryResult.results.forEach((platformResult: any) => {
        const platform = platformResult.platform || 'unknown'
        if (!platformStats[platform]) {
          platformStats[platform] = { mentions: 0, queries: 0, totalQuality: 0 }
        }
        platformStats[platform].mentions += platformResult.mentions || 0
        platformStats[platform].queries += 1
        platformStats[platform].totalQuality += platformResult.quality_score || 0
      })
    }
  })
  
  const platformTableData = Object.entries(platformStats).map(([platform, stats]) => [
    platform,
    stats.mentions.toString(),
    stats.queries.toString(),
    stats.queries > 0 ? (stats.totalQuality / stats.queries).toFixed(2) : '0.00'
  ])
  
  // Platform breakdown table
  autoTable(doc, {
    startY: currentY + 10,
    head: [['Platform', 'Total Mentions', 'Queries', 'Avg Quality']],
    body: platformTableData,
    theme: 'grid',
    styles: { fontSize: 11 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    margin: { left: 20, right: 20 }
  })
  
  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `hyperniche.ai AEO Report - Page ${i} of ${totalPages}`,
      pageWidth - 60,
      doc.internal.pageSize.getHeight() - 10
    )
  }
  
  // Return PDF as blob
  const pdfBlob = doc.output('blob')
  return pdfBlob
}
