import ExcelJS from 'exceljs'

export async function generateHealthExcel(result: any, url: string): Promise<Blob> {
  // TODO: Implement Excel generation with xlsx
  console.log('Generating health Excel for:', url)
  return new Blob(['Health Excel Placeholder'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function generateMentionsExcel(result: any, companyName: string): Promise<Blob> {
  console.log('Generating mentions Excel for:', companyName, 'with result:', result)
  
  if (!result || !result.query_results || !Array.isArray(result.query_results)) {
    console.error('Invalid result data for Excel generation:', result)
    throw new Error('No valid mentions data to export')
  }

  // Create workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'hyperniche.ai'
  workbook.created = new Date()
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary')
  
  // Summary data
  const visibility = result.visibility_percentage || 0
  const totalQueries = result.query_results?.length || 0
  const totalMentions = result.total_mentions || 0
  const band = result.visibility_band || 'Unknown'
  
  // Summary headers
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 20 }
  ]
  
  // Summary data rows
  const summaryData = [
    { metric: 'Company', value: companyName },
    { metric: 'Report Date', value: new Date().toLocaleDateString() },
    { metric: 'Overall Visibility', value: `${visibility.toFixed(1)}%` },
    { metric: 'Visibility Band', value: band },
    { metric: 'Total Queries', value: totalQueries },
    { metric: 'Total Mentions', value: totalMentions },
    { metric: 'Average Mentions per Query', value: totalQueries > 0 ? (totalMentions / totalQueries).toFixed(2) : '0.00' }
  ]
  
  summaryData.forEach(row => summarySheet.addRow(row))
  
  // Style summary sheet
  summarySheet.getRow(1).font = { bold: true }
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }
  }
  summarySheet.getRow(1).font.color = { argb: 'FFFFFFFF' }
  
  // Details Sheet
  const detailsSheet = workbook.addWorksheet('Query Results')
  
  // Details columns
  detailsSheet.columns = [
    { header: 'Query', key: 'query', width: 50 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Platform', key: 'platform', width: 15 },
    { header: 'Mentions', key: 'mentions', width: 12 },
    { header: 'Quality Score', key: 'quality_score', width: 15 },
    { header: 'Response', key: 'response', width: 60 }
  ]
  
  // Add query results data
  result.query_results.forEach((queryResult: any) => {
    if (queryResult.results && Array.isArray(queryResult.results)) {
      queryResult.results.forEach((platformResult: any) => {
        detailsSheet.addRow({
          query: queryResult.query || '',
          type: queryResult.type || queryResult.dimension || '',
          platform: platformResult.platform || '',
          mentions: platformResult.mentions || 0,
          quality_score: platformResult.quality_score || 0,
          response: typeof platformResult.response === 'string' 
            ? platformResult.response.substring(0, 500) + (platformResult.response.length > 500 ? '...' : '')
            : ''
        })
      })
    }
  })
  
  // Style details header
  detailsSheet.getRow(1).font = { bold: true }
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }
  
  // Platform Summary Sheet
  const platformSheet = workbook.addWorksheet('Platform Breakdown')
  
  platformSheet.columns = [
    { header: 'Platform', key: 'platform', width: 20 },
    { header: 'Total Mentions', key: 'mentions', width: 15 },
    { header: 'Queries', key: 'queries', width: 12 },
    { header: 'Avg Quality', key: 'avg_quality', width: 15 }
  ]
  
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
  
  Object.entries(platformStats).forEach(([platform, stats]) => {
    platformSheet.addRow({
      platform,
      mentions: stats.mentions,
      queries: stats.queries,
      avg_quality: stats.queries > 0 ? (stats.totalQuality / stats.queries).toFixed(2) : '0.00'
    })
  })
  
  // Style platform header
  platformSheet.getRow(1).font = { bold: true }
  platformSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }
  
  // Generate buffer and return blob
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
