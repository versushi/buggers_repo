#include <msp430.h> 
#include <stdint.h>
#define BUT1 BIT1 // Button S1 at Port 1.1
#define BUT2 BIT2 // Button S2 at Port 1.2
volatile unsigned int n, m, i, j, k;
void config_ACLK_to_32KHz_crystal(void);
void Initialize_LCD(void);

const unsigned char LCD_Shapes[10] = {0xFC, 0x60, 0xDB, 0xF3, 0x67, 0xB7, 0xBF, 0xE0, 0xFF, 0xE7};
int main(void){
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins

	// Initialize button with interupts
	P1DIR &= ~(BUT1|BUT2); // 0: input
	P1REN |= (BUT1|BUT2);  // 1: enable built-in resistors
	P1OUT |= (BUT1|BUT2);  // 1: built-in resistor is pulled up to Vcc
	P1IES |= (BUT1|BUT2);  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~(BUT1|BUT2); // 0: clear the interrupt flags
	P1IE  |= (BUT1|BUT2);  // 1: enable the interrupts

	// Configure ACLK to the 32 KHz crystal
	config_ACLK_to_32KHz_crystal();

	// Initializes the LCD_C module
	Initialize_LCD();

	// Timer_A: ACLK, div by 1, stop mode, clear TAR
	TA0CTL = TASSEL_1 | ID_0 | MC_0 | TACLR ;
	TA0CCR0 = 32768;
	TA0CCTL0 &= ~CCIFG;

	// Intialize the clock in stop mode
	// Decimal Point, and A4 @ 0
	LCDM20 = 0x01;
	LCDM21 =  LCD_Shapes[0];
	// Colon, and A2 @ 0
	LCDM7 = 0x04;
	LCDM6 = LCD_Shapes[0];
	// All other numbers
	n = m = j = i = k = 0;
	LCDM8  = LCD_Shapes[n];
	LCDM4  = LCD_Shapes[m];
	LCDM19 = LCD_Shapes[j];
	LCDM15 = LCD_Shapes[i];
	LCDM6  = LCD_Shapes[k];
	// Exclmation point
	LCDM3 = 0x01;
	// Turn off Exclamation
	LCDM3 &= ~0x01;
	// Turns on timer symbol
	LCDM3 |= 0x08;
	// Start the clk
	TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR;
	TA0CCTL0 &= ~CCIFG;
	__enable_interrupt();
	for(;;) {
			for (k = 0; k <= 9; k++){
				LCDM6  = LCD_Shapes[k];
				for (m = 0; m <= 5; m++){
					LCDM4  = LCD_Shapes[m];
					for (j = 0; j <= 9; j++){
						LCDM19  = LCD_Shapes[j];
						for(i = 0; i <= 5; i++){
							LCDM15  = LCD_Shapes[i]; 
							for(n=0; n<=9; ) {
								LCDM8  = LCD_Shapes[n];
								LCDM15 = LCD_Shapes[i];
								LCDM19 = LCD_Shapes[j];
								LCDM4  = LCD_Shapes[m];
								LCDM6  = LCD_Shapes[k];
								//Empty Loop to wait for a second 
								while((TA0CCTL0 & CCIFG) == 0) {};
								// Toggle the colon
								LCDM7 ^= 0x04;
								TA0CCTL0 &= ~CCIFG;
								if ((P1IN & (BUT1|BUT2)) == 0){
									if ((P1IN & (BUT1 | BUT2)) == 0) {
										// Both buttons held: count down.
										// Stay at zero rather than wrapping.
										if (n != 0 || i != 0 || j != 0 || m != 0 || k != 0) {
											if (n > 0) {
												n--;
											}
											else {
												n = 9;
												if (i > 0) {
													i--;
												}
												else {
													i = 5;
													if (j > 0) {
														j--;
													}
													else {
														j = 9;
														if (m > 0) {
															m--;
														}
														else {
															m = 5;
															k--;
														}
													}
												}
											}
										}
									}
								}
								else {
									n++;
								}
							} 
						}
					}
				}
			}
		}
	return 0;
}


#pragma vector = PORT1_VECTOR // Write the vector name
__interrupt void Port1_ISR() {
	__delay_cycles(20000);
	// The below case will run have the digits count down as the clock counts up
	if (((P1IN & BUT1) && (P1IN & BUT2) == 0)){
		__delay_cycles(20000);
		// Stop and reset the clock to make sure the new period 
		// isn't below the current count
		TA0CTL = TASSEL_1 | ID_0 | MC_0 | TACLR ;
		TA0CCTL0 &= ~CCIFG;
		// If button 2 is held adjust the period to 32768/20 = 1638 
		if ((P1IN & BUT2) == 0){
        	TA0CCR0 = 1638; // 1/20th of a second 
			// TA0CCR0 = 164;  // 1/200th of a second 
			// This line makes the next interrupt on button release
			P1IES &= ~BUT2;
   		} else {
			TA0CCR0 = 32768;
			// This line makes the next interrupt on press
			P1IES |= BUT2;
		}
		//Restarts clk
		TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR;
		// Clears S1 & S2 flag to exist ISR
		P1IFG &= ~BUT2;
		P1IFG &= ~BUT1;
	}
	// Checks if S1 is pressed 
	else if ((P1IFG & BUT1) != 0) {
   	 	__delay_cycles(20000);
    	if ((P1IN & BUT1) == 0) {
			//Checks if the timer is currently stopped
			//if it is this if statement starts it up again
        	if ((TA0CTL & MC_3) == MC_0) {
				// Start timer
				TA0CCTL0 &= ~CCIFG;
				TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR;
				// Toggle symbols 
				LCDM3 &= ~0x01; // ! off
				LCDM3 |= 0x08; 	// timer on
        	}
        	else {
            // Stop timer
            TA0CTL = TASSEL_1 | ID_0 | MC_0 | TACLR;
            TA0CCTL0 &= ~CCIFG;
			// Toggle symbols
            LCDM3 &= ~0x08; // timer off
            LCDM3 |= 0x01; 	// ! on
        	}
    	}
    	P1IFG &= ~BUT1;
	}
	else if ((P1IFG & BUT2) != 0){
		__delay_cycles(20000);
		// Stop and reset the clock to make sure the new period 
		// isn't below the current count
		TA0CTL = TASSEL_1 | ID_0 | MC_0 | TACLR ;
		TA0CCTL0 &= ~CCIFG;
		// If button 2 is held adjust the period to 32768/20 = 1638 
		if ((P1IN & BUT2) == 0){
        	TA0CCR0 = 1638; // 1/20th of a second 
			// TA0CCR0 = 164;  // 1/200th of a second 
			// This line makes the next interrupt on button release
			P1IES &= ~BUT2;
   		} else {
			TA0CCR0 = 32768;
			// This line makes the next interrupt on press
			P1IES |= BUT2;
		}
		//Restarts clk
		TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR;
		// Clears S2 flag
		P1IFG &= ~BUT2;
	}
	// Reset count; preserve start/stop mode
	if ((P1IN & BUT2) != 0 && TA0CCR0 != 32768) {
    	TA0CCR0 = 32768;
    	TA0CTL |= TACLR;       
    	TA0CCTL0 &= ~CCIFG;
	}
	// Watch for release when held, or press when released.
	if ((P1IN & BUT1) == 0) {
		P1IES &= ~BUT1;
	}
	else {
		P1IES |= BUT1;
	}

	if ((P1IN & BUT2) == 0) {
		P1IES &= ~BUT2;
	}
	else {
		P1IES |= BUT2;
	}
	P1IFG &= ~(BUT1 | BUT2);
}

// Configures ACLK to 32 KHz crystal
void config_ACLK_to_32KHz_crystal() {
// By default, ACLK runs on LFMODCLK at 5MHz/128 = 39 KHz
// Reroute pins to LFXIN/LFXOUT functionality
	PJSEL1 &= ~BIT4;
	PJSEL0 |= BIT4;
	// Wait until the oscillator fault flags remain cleared
	CSCTL0 = CSKEY; // Unlock CS registers
	do {
		CSCTL5 &= ~LFXTOFFG; // Local fault flag
		SFRIFG1 &= ~OFIFG; // Global fault flag
	}
	while((CSCTL5 & LFXTOFFG) != 0);
		CSCTL0_H = 0; // Lock CS registers
	return;
}

// Initializes the LCD_C module
// *** Source: Function obtained from MSP430FR6989’s Sample Code ***
void Initialize_LCD() {
	PJSEL0 = BIT4 | BIT5; // For LFXT

	LCDCPCTL0 = 0xFFD0;
	LCDCPCTL1 = 0xF83F;
	LCDCPCTL2 = 0x00F8;

	// Configure LFXT 32kHz crystal
	CSCTL0_H = CSKEY >> 8; 		// Unlock CS registers
	CSCTL4 &= ~LFXTOFF; 		// Enable LFXT
	do {
		CSCTL5 &= ~LFXTOFFG; 	// Clear LFXT fault flag
		SFRIFG1 &= ~OFIFG;
	}
	while (SFRIFG1 & OFIFG); 	// Test oscillator fault flag
	CSCTL0_H = 0; 				// Lock CS registers
	
	// Initialize LCD_C
	// ACLK, Divider = 1, Pre-divider = 16; 4-pin MUX
	LCDCCTL0 = LCDDIV__1 | LCDPRE__16 | LCD4MUX | LCDLP;
	
	// VLCD generated internally,
	// V2-V4 generated internally, v5 to ground
	// Set VLCD voltage to 2.60v
	// Enable charge pump and select internal reference for it
	LCDCVCTL = VLCD_1 | VLCDREF_0 | LCDCPEN;

	LCDCCPCTL = LCDCPCLKSYNC; 	// Clock synchronization enabled
	LCDCMEMCTL = LCDCLRM; 		// Clear LCD memory
	
	//Turn LCD on (do this at the end!)
	LCDCCTL0 |= LCDON;

	return;
}
