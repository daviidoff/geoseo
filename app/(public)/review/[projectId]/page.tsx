'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Lock, FileText, CheckCircle, XCircle, MessageSquare, Loader2 } from 'lucide-react'

interface Article {
  id: string
  headline: string
  slug: string
  keyword: string
  quality_score: number
  word_count: number
  status: string
  content: {
    article_html?: string
    meta_description?: string
    [key: string]: unknown
  }
  created_at: string
  feedback?: string
}

interface Project {
  id: string
  name: string
  website_url: string
  client_name: string
}

export default function ReviewPortalPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Check for existing session
  useEffect(() => {
    const storedToken = sessionStorage.getItem(`review_token_${projectId}`)
    if (storedToken) {
      verifyToken(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [projectId])

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`/api/review/${projectId}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
        setIsAuthenticated(true)
        sessionStorage.setItem(`review_token_${projectId}`, token)
        await fetchArticles(token)
      } else {
        sessionStorage.removeItem(`review_token_${projectId}`)
      }
    } catch {
      sessionStorage.removeItem(`review_token_${projectId}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsLoading(true)

    try {
      const res = await fetch(`/api/review/${projectId}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: password }),
      })

      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
        setIsAuthenticated(true)
        sessionStorage.setItem(`review_token_${projectId}`, password)
        await fetchArticles(password)
      } else {
        const error = await res.json()
        setAuthError(error.error || 'Invalid password')
      }
    } catch {
      setAuthError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchArticles = async (token: string) => {
    try {
      const res = await fetch(`/api/review/${projectId}/articles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles || [])
      }
    } catch {
      console.error('Failed to fetch articles')
    }
  }

  const handleApprove = async (articleId: string) => {
    const token = sessionStorage.getItem(`review_token_${projectId}`)
    if (!token) return

    try {
      const res = await fetch(`/api/review/${projectId}/articles/${articleId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (res.ok) {
        setArticles(prev =>
          prev.map(a => a.id === articleId ? { ...a, status: 'approved' } : a)
        )
        setSelectedArticle(null)
      }
    } catch {
      console.error('Failed to approve article')
    }
  }

  const handleReject = async (articleId: string, feedback: string) => {
    const token = sessionStorage.getItem(`review_token_${projectId}`)
    if (!token) return

    setSubmittingFeedback(true)
    try {
      const res = await fetch(`/api/review/${projectId}/articles/${articleId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reject', feedback }),
      })

      if (res.ok) {
        setArticles(prev =>
          prev.map(a => a.id === articleId ? { ...a, status: 'draft', feedback } : a)
        )
        setSelectedArticle(null)
        setFeedbackText('')
      }
    } catch {
      console.error('Failed to reject article')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>
      case 'review':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending Review</Badge>
      case 'draft':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Needs Revision</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Article Review Portal</CardTitle>
            <CardDescription>
              Enter your review password to access your articles
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Enter review password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={!password || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Access Articles
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{project?.name || 'Article Review'}</h1>
          <p className="text-muted-foreground">
            {project?.website_url} - {articles.filter(a => a.status === 'review').length} articles pending review
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {articles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No articles available for review yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Card
                key={article.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedArticle(article)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">{article.headline}</CardTitle>
                    {getStatusBadge(article.status)}
                  </div>
                  <CardDescription>
                    Keyword: {article.keyword}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Quality: {article.quality_score}/100</span>
                    <span>{article.word_count} words</span>
                  </div>
                  {article.feedback && (
                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      {article.feedback}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedArticle.headline}</DialogTitle>
                <DialogDescription>
                  Keyword: {selectedArticle.keyword} | {selectedArticle.word_count} words | Quality: {selectedArticle.quality_score}/100
                </DialogDescription>
              </DialogHeader>

              <div className="prose prose-sm dark:prose-invert max-w-none my-4">
                {selectedArticle.content?.meta_description && (
                  <div className="bg-muted p-3 rounded mb-4 text-sm">
                    <strong>Meta Description:</strong> {selectedArticle.content.meta_description}
                  </div>
                )}
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedArticle.content?.article_html || '<p>No content available</p>'
                  }}
                />
              </div>

              {selectedArticle.status === 'review' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feedback (optional for rejection)</label>
                    <Textarea
                      placeholder="Provide feedback for the article..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedArticle.id, feedbackText)}
                      disabled={submittingFeedback}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Request Changes
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedArticle.id)}
                      disabled={submittingFeedback}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Article
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedArticle.status === 'approved' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="text-green-500 font-medium">This article has been approved</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
