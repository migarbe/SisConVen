import React, { useEffect, useState } from 'react'
import { Tooltip, Typography } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import { getRateSource, getBcvFechaVigencia } from '../utils/exchangeRateService'

export default function RateSource() {
    const [source, setSource] = useState(getRateSource())
    const [fecha, setFecha] = useState(getBcvFechaVigencia())

    useEffect(() => {
        // simple interval to refresh values; parent may not re-render constantly
        const id = setInterval(() => {
            setSource(getRateSource())
            setFecha(getBcvFechaVigencia())
        }, 60000) // once a minute
        return () => clearInterval(id)
    }, [])

    if (!source && !fecha) return null
    const parts = []
    if (source) parts.push(`Fuente: ${source}`)
    if (fecha) parts.push(`Fecha vigencia: ${fecha}`)
    const text = parts.join(' • ')

    return (
        <Tooltip title={text} placement="top">
            <Typography variant="body2" color="textSecondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                {text} <InfoIcon fontSize="small" />
            </Typography>
        </Tooltip>
    )
}
