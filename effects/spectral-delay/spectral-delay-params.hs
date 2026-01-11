-- Spectral Delay Effect Parameters
-- A weird spectral delay that filters the signal into frequency bands
-- and delays them with bitwise patterns

-- Parameters:
-- tsdelay: Time scale for delay (0-1), controls the overall delay time
-- xsdelay: Delay structure pattern (integer), determines which frequency bands are delayed via bitwise AND

:{
let tsdelay = pF "tsdelay"
    xsdelay = pI "xsdelay"
:}
