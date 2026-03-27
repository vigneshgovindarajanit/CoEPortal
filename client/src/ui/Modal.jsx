import { Dialog, DialogContent, DialogTitle } from '@mui/material'

export default function Modal({ title, children, ...props }) {
  return (
    <Dialog {...props}>
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )
}
