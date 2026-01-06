-- Convolution Reverb Parameters for TidalCycles

-- Convolution mix (wet/dry balance): 0 = fully dry, 1 = fully wet
let convolvemix = pF "convolvemix"
    convolve = pF "convolve"

-- Impulse response selection: 0-51 (choose which IR to use)
let convolveir = pI "convolveir"

-- High frequency damping: 0 = dark (800Hz), 1 = bright (18kHz)
let convolvedamp = pF "convolvedamp"

-- Pre-delay: 0-0.2 seconds (delay before reverb starts)
let convolvepredel = pF "convolvepredel"

-- Output level: 0-2 (boost/cut reverb output, default 1.0)
let convolvelevel = pF "convolvelevel"

-- Super IR - sends array of IR indices to SC which creates and adds the super IR
let makeSuperIR irList = mapM_ (\i -> once $ s "superir" # n (fromIntegral i)) irList

-- Presets
let superCathedral = makeSuperIR [6, 6]
    superBass = makeSuperIR [42, 43, 44]
    superVintage = makeSuperIR [13, 14, 15]
    superMassive = makeSuperIR [6, 42]
    superClub = makeSuperIR [45, 46, 47, 48]
    superMega = makeSuperIR [42,43,44,45,46,47,48,49,50,51,0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,17,18,27,33,35]
