-- Poll C++ binary state.json and feed controls into Tidal via streamSet
-- Run after Tidal is booted: :script "/Users/andrewgrosser/Documents/tidal/ctrl-poll.hs"

import Network.HTTP.Client
import Data.Aeson
import Data.Aeson.Types
import qualified Data.HashMap.Strict as HM
import Control.Concurrent
import Control.Exception (try, SomeException)

:{
let pollAndSet = do
      mgr <- newManager defaultManagerSettings
      let loop = do
            result <- try $ do
              req <- parseRequest "http://localhost:8081/state.json"
              resp <- httpLbs req mgr
              case decode (responseBody resp) of
                Just (Object obj) -> do
                  let getF k def = case HM.lookup k obj of
                        Just (Number n) -> realToFrac n
                        _ -> def
                  let numHands = getF "num_hands" 0
                  let progress = getF "progress" 0
                  let level    = getF "level" 0
                  streamSet tidal "num_hands" (pure numHands :: Pattern Double)
                  streamSet tidal "progress"  (pure progress :: Pattern Double)
                  streamSet tidal "instrument_level" (pure level :: Pattern Double)
                  -- Per-hand data
                  case HM.lookup "hands" obj of
                    Just (Array hands) -> do
                      let setHand i h = case h of
                            Object ho -> do
                              let hg k d = case HM.lookup k ho of
                                    Just (Number n) -> realToFrac n; _ -> d
                              streamSet tidal ("hand" ++ show i ++ "_x") (pure (hg "x" 0.5) :: Pattern Double)
                              streamSet tidal ("hand" ++ show i ++ "_y") (pure (hg "y" 0.5) :: Pattern Double)
                              streamSet tidal ("hand" ++ show i ++ "_z") (pure (hg "z" 0.5) :: Pattern Double)
                            _ -> return ()
                      mapM_ (\(i,h) -> setHand i h) (zip [0..] (toList hands))
                    _ -> return ()
                _ -> return ()
            :: IO (Either SomeException ())
            threadDelay 50000  -- 20Hz
            loop
      loop
:}

forkIO pollAndSet
