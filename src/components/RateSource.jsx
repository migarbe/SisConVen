import React from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import { getRateSource, getBcvFechaVigencia } from '../utils/exchangeRateService'

export default function RateSource({ small = false }) {
    const source = getRateSource()
    const fecha = getBcvFechaVigencia()

    if (!source && !fecha) return null

    const tooltip = source === 'SISCONVEN'
        ? 'Tasa oficial obtenida desde SISCONVEN (BCV JSON).'
        : 'Tasa obtenida desde DolarAPI o desde caché local.'

    return (
        <Box>
            <Typography variant={small ? 'caption' : 'body2'} color="textSecondary" component="div">
                {source && (`Fuente: ${source}`)}{source && fecha ? ' • ' : ''}{fecha && (`Fecha vigencia: ${fecha}`)}
                <Tooltip title={tooltip} placement="top">
                    <InfoIcon fontSize={small ? 'small' : 'inherit'} style={{ marginLeft: 8, verticalAlign: 'middle', cursor: 'pointer' }} />
                </Tooltip>
            </Typography>
        </Box>
    )
}
