
cd ..

set GOOS=linux
set GOPACH=amd64

set DIRPATH=%cd%
set GOPATH=%cd%

go build -a -v -gcflags "-N -l" -o ./bin/sgserver

pause