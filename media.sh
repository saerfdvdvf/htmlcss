#!/bin/bash
# Genera 10 números aleatorios del 1 al 10, los guarda en un array y calcula la media

declare -a numeros
suma=0

for (( i=0; i<10; i++ )); do
    numeros[$i]=$(( RANDOM % 10 + 1 ))
    suma=$(( suma + numeros[i] ))
done

total=${#numeros[@]}
media=$(echo "scale=2; $suma / $total" | bc)

echo "Números generados: ${numeros[@]}"
echo "Cantidad: $total"
echo "Suma: $suma"
echo "Media: $media"
