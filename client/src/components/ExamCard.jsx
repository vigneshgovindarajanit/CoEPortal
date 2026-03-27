import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function ExamCard({ title, subtitle, children }) {
  return (
    <Card elevation={0}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">{title}</Typography>
          {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}
