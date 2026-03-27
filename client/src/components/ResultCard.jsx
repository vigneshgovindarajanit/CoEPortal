import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function ResultCard({ label, value, helperText }) {
  return (
    <Card elevation={0}>
      <CardContent>
        <Stack spacing={1}>
          <Typography color="text.secondary">{label}</Typography>
          <Typography variant="h5">{value}</Typography>
          {helperText ? <Typography color="text.secondary">{helperText}</Typography> : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
